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
