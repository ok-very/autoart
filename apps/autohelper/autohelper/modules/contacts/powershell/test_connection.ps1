<#
.SYNOPSIS
    Test Exchange Online connectivity.

.PARAMETER AuthJson
    JSON string with auth credentials (upn, organization, app_id, cert_thumbprint).
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AuthJson
)

$ErrorActionPreference = "Stop"

$result = @{
    connected = $false
    message   = ""
}

try {
    $auth = $AuthJson | ConvertFrom-Json

    if (-not (Get-Module -ListAvailable -Name ExchangeOnlineManagement)) {
        $result.message = "ExchangeOnlineManagement module not installed. Run: Install-Module ExchangeOnlineManagement -Force"
        $result | ConvertTo-Json -Compress
        exit 1
    }

    Import-Module ExchangeOnlineManagement -ErrorAction Stop

    $connectParams = @{}

    if ($auth.app_id -and $auth.cert_thumbprint -and $auth.organization) {
        $connectParams = @{
            AppId               = $auth.app_id
            CertificateThumbprint = $auth.cert_thumbprint
            Organization        = $auth.organization
            ShowBanner          = $false
        }
    }
    elseif ($auth.upn) {
        $connectParams = @{
            UserPrincipalName = $auth.upn
            ShowBanner        = $false
        }
    }
    else {
        $result.message = "No valid authentication credentials provided"
        $result | ConvertTo-Json -Compress
        exit 1
    }

    Connect-ExchangeOnline @connectParams

    # Quick verification - list organization config
    $orgConfig = Get-OrganizationConfig -ErrorAction Stop
    $result.connected = $true
    $result.message = "Connected to $($orgConfig.DisplayName)"

    Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue
}
catch {
    $result.message = "Connection failed: $($_.Exception.Message)"
}

$result | ConvertTo-Json -Compress
