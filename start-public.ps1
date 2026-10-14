$ErrorActionPreference = "Stop"

$repo = $PSScriptRoot
$backend = Join-Path $repo "backend"
$frontend = Join-Path $repo "frontend"
$tunnelConfig = Join-Path $repo "cloudflared\config.yml"
$logDirectory = Join-Path $env:TEMP "Mail-Nexus-logs"
$script:ManagedProcesses = @()
$script:ServiceStates = @{}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-ServiceStatus {
    param(
        [string]$Name,
        [bool]$Working,
        [string]$Details,
        [switch]$Always
    )

    $state = if ($Working) { "WORKING" } else { "NOT WORKING" }
    $changed = -not $script:ServiceStates.ContainsKey($Name) -or $script:ServiceStates[$Name] -ne $state
    $script:ServiceStates[$Name] = $state
    if ($changed -or $Always) {
        $color = if ($Working) { "Green" } else { "Red" }
        Write-Host "[$state] $Name - $Details" -ForegroundColor $color
    }
}

function Test-HttpEndpoint {
    param([string]$Uri)

    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
        $ok = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
        return [pscustomobject]@{
            Working = $ok
            Details = "HTTP $($response.StatusCode)"
        }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { }
        }
        $details = if ($statusCode) { "HTTP $statusCode" } else { $_.Exception.Message }
        return [pscustomobject]@{
            Working = $false
            Details = $details
        }
    }
}

function Start-ManagedService {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$ReadyUri,
        [switch]$Force
    )

    if (-not $Force) {
        $probe = Test-HttpEndpoint $ReadyUri
        if ($probe.Working) {
            Write-ServiceStatus $Name $true "already running at $ReadyUri ($($probe.Details))"
            return
        }
    }

    if (-not (Test-Path $FilePath) -and -not (Get-Command $FilePath -ErrorAction SilentlyContinue)) {
        Write-ServiceStatus $Name $false "executable '$FilePath' was not found"
        return
    }

    $safeName = $Name -replace '[^A-Za-z0-9-]', '-'
    $stdout = Join-Path $logDirectory "$safeName.stdout.log"
    $stderr = Join-Path $logDirectory "$safeName.stderr.log"
    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $ArgumentList `
            -WorkingDirectory $WorkingDirectory `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru
        $script:ManagedProcesses += [pscustomobject]@{
            Name = $Name
            Process = $process
            Stdout = $stdout
            Stderr = $stderr
            ReadyUri = $ReadyUri
        }
        Write-Host "[STARTING] $Name (PID $($process.Id))"
    } catch {
        Write-ServiceStatus $Name $false "could not start: $($_.Exception.Message)"
    }
}

function Wait-ForEndpoint {
    param(
        [string]$Name,
        [string]$Uri,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $lastDetails = "waiting for $Uri"
    while ((Get-Date) -lt $deadline) {
        $probe = Test-HttpEndpoint $Uri
        if ($probe.Working) {
            Write-ServiceStatus $Name $true "$Uri ($($probe.Details))"
            return $true
        }
        $lastDetails = "$Uri ($($probe.Details))"
        $managed = $script:ManagedProcesses | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
        if ($managed) {
            $managed.Process.Refresh()
            if ($managed.Process.HasExited) {
                $logHint = "logs: $($managed.Stdout), $($managed.Stderr)"
                $stderrTail = if (Test-Path $managed.Stderr) { (Get-Content $managed.Stderr -Tail 8) -join " | " } else { "" }
                if ($stderrTail) { $logHint += "; error: $stderrTail" }
                Write-ServiceStatus $Name $false "process exited with code $($managed.Process.ExitCode); $logHint"
                return $false
            }
        }
        Start-Sleep -Seconds 2
    }

    $managed = $script:ManagedProcesses | Where-Object { $_.Name -eq $Name } | Select-Object -First 1
    $logHint = if ($managed) { "logs: $($managed.Stdout), $($managed.Stderr)" } else { "" }
    Write-ServiceStatus $Name $false "timed out; $lastDetails $logHint"
    return $false
}

$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    $python = if ($pythonCommand) { $pythonCommand.Source } else { "python" }
}
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
$cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue

if (-not (Test-Path $tunnelConfig)) {
    throw "Cloudflare config is missing: $tunnelConfig"
}
if (-not $cloudflaredCommand) {
    Write-ServiceStatus "Cloudflare tunnel" $false "cloudflared is not installed or is not on PATH"
}
if (-not $npmCommand) {
    Write-ServiceStatus "College frontend" $false "npm.cmd is not installed or is not on PATH"
    Write-ServiceStatus "Central frontend" $false "npm.cmd is not installed or is not on PATH"
}

$previousPublicApi = $env:NEXT_PUBLIC_API_URL
$previousInternalApi = $env:MAIL_NEXUS_INTERNAL_API_URL
$env:NEXT_PUBLIC_API_URL = "https://api.edushield1.in"
$env:MAIL_NEXUS_INTERNAL_API_URL = "http://127.0.0.1:8000"

try {
    Start-ManagedService "Backend" $python @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000") $backend "http://127.0.0.1:8000/health"
    if ($npmCommand) {
        Start-ManagedService "College frontend" $npmCommand.Source @("run", "dev") (Join-Path $frontend "college") "http://127.0.0.1:3000"
        Start-ManagedService "Central frontend" $npmCommand.Source @("run", "dev") (Join-Path $frontend "central") "http://127.0.0.1:3001"
    }
} finally {
    $env:NEXT_PUBLIC_API_URL = $previousPublicApi
    $env:MAIL_NEXUS_INTERNAL_API_URL = $previousInternalApi
}

if ($cloudflaredCommand -and -not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
    Start-ManagedService "Cloudflare tunnel" $cloudflaredCommand.Source @("tunnel", "--config", "`"$tunnelConfig`"", "run") $repo "https://api.edushield1.in/health" -Force
} elseif ($cloudflaredCommand) {
    Write-Host "[STARTING] Cloudflare tunnel process is already running; checking public routes."
}

Write-Host "`n--- Mail-Nexus startup checks ---"
$null = Wait-ForEndpoint "Backend" "http://127.0.0.1:8000/health"
$null = Wait-ForEndpoint "College frontend" "http://127.0.0.1:3000"
$null = Wait-ForEndpoint "Central frontend" "http://127.0.0.1:3001"
$null = Wait-ForEndpoint "Public API" "https://api.edushield1.in/health" 75
$null = Wait-ForEndpoint "College public site" "https://mail.edushield1.in" 75
$null = Wait-ForEndpoint "Central public site" "https://soc.edushield1.in" 75
$initialApiProbe = Test-HttpEndpoint "https://api.edushield1.in/health"
$initialTunnelProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
$tunnelWorking = [bool]$initialTunnelProcess -and $initialApiProbe.Working
$tunnelDetails = if (-not $initialTunnelProcess) { "cloudflared process is not running" } else { "public API route ($($initialApiProbe.Details))" }
Write-ServiceStatus "Cloudflare tunnel" $tunnelWorking $tunnelDetails

Write-Host "`nCollege portal: https://mail.edushield1.in"
Write-Host "Central SOC:    https://soc.edushield1.in"
Write-Host "API health:     https://api.edushield1.in/health"
Write-Host "Logs:           $logDirectory"
Write-Host "Press Ctrl+C to stop services started by this launcher."

try {
    while ($true) {
        Start-Sleep -Seconds 10
        foreach ($service in @(
            @{ Name = "Backend"; Uri = "http://127.0.0.1:8000/health" },
            @{ Name = "College frontend"; Uri = "http://127.0.0.1:3000" },
            @{ Name = "Central frontend"; Uri = "http://127.0.0.1:3001" },
            @{ Name = "Public API"; Uri = "https://api.edushield1.in/health" },
            @{ Name = "College public site"; Uri = "https://mail.edushield1.in" },
            @{ Name = "Central public site"; Uri = "https://soc.edushield1.in" }
        )) {
            $probe = Test-HttpEndpoint $service.Uri
            $details = "$($service.Uri) ($($probe.Details))"
            if (-not $probe.Working) {
                $managed = $script:ManagedProcesses | Where-Object { $_.Name -eq $service.Name } | Select-Object -First 1
                if ($managed) { $details += "; logs: $($managed.Stdout), $($managed.Stderr)" }
            }
            Write-ServiceStatus $service.Name $probe.Working $details
        }

        $cloudflareProcess = Get-Process cloudflared -ErrorAction SilentlyContinue
        $publicApiProbe = Test-HttpEndpoint "https://api.edushield1.in/health"
        $tunnelWorking = [bool]$cloudflareProcess -and $publicApiProbe.Working
        $tunnelDetails = if (-not $cloudflareProcess) { "cloudflared process is not running" } else { "public API route ($($publicApiProbe.Details))" }
        Write-ServiceStatus "Cloudflare tunnel" $tunnelWorking $tunnelDetails

        foreach ($managed in $script:ManagedProcesses) {
            $managed.Process.Refresh()
            if ($managed.Process.HasExited) {
                $details = "process exited with code $($managed.Process.ExitCode); logs: $($managed.Stdout), $($managed.Stderr)"
                Write-ServiceStatus $managed.Name $false $details
            }
        }
    }
} finally {
    Write-Host "`nStopping services started by this launcher..."
    foreach ($managed in $script:ManagedProcesses) {
        $managed.Process.Refresh()
        if (-not $managed.Process.HasExited) {
            & taskkill.exe /PID $managed.Process.Id /T /F 2>$null | Out-Null
        }
    }
    Write-Host "Launcher-managed services stopped."
}