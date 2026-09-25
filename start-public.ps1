$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $repo "backend"
$frontend = Join-Path $repo "frontend"
$tunnelConfig = Join-Path $repo "cloudflared\config.yml"

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    throw "cloudflared is not installed or is not on PATH."
}

$env:NEXT_PUBLIC_API_URL = "https://api.edushield1.in"
$env:MAIL_NEXUS_INTERNAL_API_URL = "http://127.0.0.1:8000"

$processes = @()
$processes += Start-Process -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $backend -PassThru
$processes += Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory (Join-Path $frontend "college") -PassThru
$processes += Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory (Join-Path $frontend "central") -PassThru
$processes += Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --config `"$tunnelConfig`" run" -WorkingDirectory $repo -PassThru

Start-Sleep -Seconds 3
try {
    $health = Invoke-RestMethod -Uri "https://api.edushield1.in/health" -TimeoutSec 10
    Write-Host "Mail-Nexus is running through Cloudflare. API status: $($health.status)"
} catch {
    Write-Warning "The processes started, but the public API health check failed: $($_.Exception.Message)"
}

Write-Host "College portal: https://mail.edushield1.in"
Write-Host "Central SOC:    https://soc.edushield1.in"
Write-Host "API health:     https://api.edushield1.in/health"
Write-Host "Cloudflare email webhook: https://api.edushield1.in/webhooks/email"
Write-Host "Press Ctrl+C to stop this launcher."

try {
    while ($true) {
        $running = $processes | Where-Object { -not $_.HasExited }
        if (-not $running) {
            throw "All Mail-Nexus processes exited."
        }
        Start-Sleep -Seconds 5
    }
} finally {
    $processes | Where-Object { -not $_.HasExited } | Stop-Process
}