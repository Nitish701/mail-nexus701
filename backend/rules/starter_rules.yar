/*
 * Mail-Nexus starter ruleset for suspicious email attachments.
 * Targets common script droppers, encoded command execution, Office auto-run
 * macros, and shell launch chains. These indicators are heuristic, not proof
 * that a file is malicious; matched files should be reviewed in context.
 */

rule MailNexus_EICAR_Test_String {
    meta:
        description = "Detects the standard harmless antivirus test string"
        severity = "high"
    strings:
        $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    condition:
        $eicar
}

rule MailNexus_Suspicious_PowerShell_Attachment {
    meta:
        description = "Detects common PowerShell download and execution terms"
        severity = "medium"
    strings:
        $powershell = "powershell" nocase
        $download = "downloadstring" nocase
        $invoke = "invoke-expression" nocase
    condition:
        $powershell and 1 of ($download, $invoke)
}

rule MailNexus_PowerShell_Encoded_Command {
    meta:
        description = "Detects PowerShell encoded-command execution with a Base64 decode indicator"
        author = "Mail-Nexus"
        severity = "high"
    strings:
        $powershell = "powershell" nocase ascii wide
        $pwsh = "pwsh" nocase ascii wide
        $encoded_command = "-encodedcommand" nocase ascii wide
        $encoded_short = "-enc" nocase ascii wide
        $base64_decode = "FromBase64String" nocase ascii wide
    condition:
        filesize < 10MB and
        1 of ($powershell, $pwsh) and
        1 of ($encoded_command, $encoded_short) and
        $base64_decode
}

rule MailNexus_Script_ActiveX_Downloader {
    meta:
        description = "Detects script-style ActiveX download and file-write behavior"
        author = "Mail-Nexus"
        severity = "high"
    strings:
        $activex = "ActiveXObject" nocase ascii wide
        $wscript_shell = "WScript.Shell" nocase ascii wide
        $xmlhttp = "XMLHTTP" nocase ascii wide
        $server_xmlhttp = "ServerXMLHTTP" nocase ascii wide
        $adodb_stream = "ADODB.Stream" nocase ascii wide
    condition:
        filesize < 10MB and
        1 of ($activex, $wscript_shell) and
        1 of ($xmlhttp, $server_xmlhttp) and
        $adodb_stream
}

rule MailNexus_JavaScript_Eval_Obfuscation {
    meta:
        description = "Detects JavaScript eval with string decoding and script-host execution indicators"
        author = "Mail-Nexus"
        severity = "medium"
    strings:
        $eval = "eval(" nocase ascii wide
        $unescape = "unescape(" nocase ascii wide
        $from_char_code = "fromCharCode(" nocase ascii wide
        $activex = "ActiveXObject" nocase ascii wide
        $wscript = "WScript" nocase ascii wide
    condition:
        filesize < 5MB and
        $eval and
        1 of ($unescape, $from_char_code) and
        1 of ($activex, $wscript)
}

rule MailNexus_Office_AutoExec_Macro {
    meta:
        description = "Detects Office auto-execution macro names combined with object creation and shell execution"
        author = "Mail-Nexus"
        severity = "high"
    strings:
        $auto_open = "AutoOpen" nocase ascii wide
        $auto_underscore = "Auto_Open" nocase ascii wide
        $document_open = "Document_Open" nocase ascii wide
        $create_object = "CreateObject" nocase ascii wide
        $shell = "Shell" nocase ascii wide
        $powershell = "powershell" nocase ascii wide
        $wscript_shell = "WScript.Shell" nocase ascii wide
    condition:
        filesize < 10MB and
        1 of ($auto_open, $auto_underscore, $document_open) and
        $create_object and
        1 of ($shell, $powershell, $wscript_shell)
}

rule MailNexus_Suspicious_Command_Shell_Launch {
    meta:
        description = "Detects cmd.exe /c launching a script host or system utility"
        author = "Mail-Nexus"
        severity = "medium"
    strings:
        $cmd = "cmd.exe" nocase ascii wide
        $slash_c = "/c" ascii wide
        $powershell = "powershell" nocase ascii wide
        $wscript = "wscript" nocase ascii wide
        $cscript = "cscript" nocase ascii wide
        $mshta = "mshta" nocase ascii wide
        $rundll32 = "rundll32" nocase ascii wide
        $regsvr32 = "regsvr32" nocase ascii wide
    condition:
        filesize < 10MB and
        $cmd and
        $slash_c and
        1 of ($powershell, $wscript, $cscript, $mshta, $rundll32, $regsvr32)
}

rule MailNexus_Base64_Decode_And_Execute {
    meta:
        description = "Detects encoded data decoding combined with a script or shell execution indicator"
        author = "Mail-Nexus"
        severity = "medium"
    strings:
        $from_base64 = "FromBase64String" nocase ascii wide
        $atob = "atob(" nocase ascii wide
        $certutil_decode = "certutil" nocase ascii wide
        $decode_switch = "-decode" nocase ascii wide
        $wscript_shell = "WScript.Shell" nocase ascii wide
        $activex = "ActiveXObject" nocase ascii wide
        $powershell = "powershell" nocase ascii wide
        $cmd = "cmd.exe" nocase ascii wide
    condition:
        filesize < 10MB and
        (
            $from_base64 or
            $atob or
            ($certutil_decode and $decode_switch)
        ) and
        1 of ($wscript_shell, $activex, $powershell, $cmd)
}
