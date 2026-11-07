[CmdletBinding()]
param(
    [switch]$BuildOnly,
    [switch]$DeployOnly,
    [switch]$Incremental,
    [ValidatePattern('^(?:[a-zA-Z0-9_][a-zA-Z0-9_.-]*@)?[a-zA-Z0-9][a-zA-Z0-9.-]*\z')]
    [string]$SshTarget = 'kjg@192.168.1.74',
    [ValidatePattern('^(?:/[a-zA-Z0-9_][a-zA-Z0-9_.-]*)+\z')]
    [string]$RemoteDir = '/home/kjg/work/english-starry-sky',
    [ValidateRange(1024, 65535)]
    [int]$Port = 8091
)

$ErrorActionPreference = 'Stop'
if ($BuildOnly -and $DeployOnly) {
    throw 'Choose either -BuildOnly or -DeployOnly.'
}
if ($BuildOnly -and $Incremental) {
    throw '-Incremental requires an active server release. Use it with deployment, or with -DeployOnly to reuse a local archive.'
}

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root 'dist'
$PackageName = 'english-starry-sky.tar.gz'
$SavedArchive = Join-Path $Dist $PackageName
$Release = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
$ReleaseArchiveName = "english-starry-sky-$Release.tar.gz"
$ReuseSavedArchive = $DeployOnly -and -not $Incremental
$Archive = if ($ReuseSavedArchive) { $SavedArchive } else { Join-Path $Dist $ReleaseArchiveName }
$BaseManifest = Join-Path $Dist "lan-base-$Release.json"
$Builder = Join-Path $PSScriptRoot 'build-lan.py'

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Program exited with code $LASTEXITCODE."
    }
}

if ($BuildOnly) {
    Invoke-Checked python @($Builder, $SavedArchive)
    return
}
if ($DeployOnly -and (-not (Test-Path -LiteralPath $SavedArchive -PathType Leaf) -or (Get-Item -LiteralPath $SavedArchive).Length -eq 0)) {
    throw "Missing or empty release archive: $SavedArchive. Run deploy-lan.ps1 -BuildOnly first."
}

$Incoming = "$RemoteDir/.incoming/$Release"
$Helper = Join-Path $PSScriptRoot 'deploy-lan-remote.sh'
$RemoteHelper = "$Incoming/deploy-lan-remote.lf.sh"
$IncomingCreated = $false
$ActivationStarted = $false
try {
    if (-not $DeployOnly -and -not $Incremental) {
        Invoke-Checked python @($Builder, $Archive)
    }
    Invoke-Checked ssh @('-o', 'ConnectTimeout=10', $SshTarget, "umask 077; mkdir -p -- '$RemoteDir/.incoming' && mkdir -- '$Incoming'")
    $IncomingCreated = $true
    if ($Incremental) {
        $DeltaHelper = Join-Path $PSScriptRoot 'lan_delta.py'
        Invoke-Checked scp @('-o', 'ConnectTimeout=10', $DeltaHelper, "${SshTarget}:${Incoming}/")
        $Manifest = Invoke-Checked ssh @('-o', 'ConnectTimeout=10', $SshTarget, "python3 '$Incoming/lan_delta.py' inventory '$RemoteDir'")
        $null = New-Item -ItemType Directory -Force -Path $Dist
        Set-Content -LiteralPath $BaseManifest -Value $Manifest -Encoding Ascii
        $BuildArgs = @($Builder, $Archive, '--base-manifest', $BaseManifest)
        if ($DeployOnly) { $BuildArgs += @('--from-archive', $SavedArchive) }
        Invoke-Checked python $BuildArgs
    }
    Invoke-Checked scp @('-o', 'ConnectTimeout=10', $Archive, $Helper, "${SshTarget}:${Incoming}/")
    $PrepareCommand = "tr -d '\r' < '$Incoming/deploy-lan-remote.sh' > '$RemoteHelper'"
    if ($ReuseSavedArchive) {
        $PrepareCommand = "mv -- '$Incoming/$PackageName' '$Incoming/$ReleaseArchiveName' && $PrepareCommand"
    }
    Invoke-Checked ssh @('-o', 'ConnectTimeout=10', $SshTarget, $PrepareCommand)

    # Once Bash starts, it owns cleanup even if this SSH session is interrupted.
    $ActivationStarted = $true
    Invoke-Checked ssh @('-o', 'ConnectTimeout=10', $SshTarget, "bash '$RemoteHelper' '$RemoteDir' '$Release' '$Port'")
    $ServerName = ($SshTarget -split '@')[-1]
    Write-Host "Deployed English Starry Sky to http://${ServerName}:${Port}/"
} finally {
    if ($IncomingCreated -and -not $ActivationStarted) {
        try {
            Invoke-Checked ssh @('-o', 'ConnectTimeout=10', $SshTarget, "rm -rf -- '$Incoming'")
        } catch {
            Write-Warning "Could not clean up ${SshTarget}:${Incoming}."
        }
    }
    if (-not $ReuseSavedArchive) {
        Remove-Item -LiteralPath $Archive -ErrorAction SilentlyContinue
    }
    if ($Incremental) {
        Remove-Item -LiteralPath $BaseManifest -ErrorAction SilentlyContinue
    }
}
