param(
  [Parameter(Mandatory)]
  [string]$Confirmation
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$requiredConfirmation = 'CONFIRM MAIN PUMP SUBMERGED AND 12V ON FOR ONE 1000MS PULSE'
if ($Confirmation -cne $requiredConfirmation) {
  throw "Exact confirmation required: $requiredConfirmation"
}

$paths = Get-Stage1Paths
$verificationPath = Join-Path $paths.Secrets 'stage2-firmware-verified.json'
if (-not (Test-Path -LiteralPath $verificationPath)) { throw 'Verified Stage 2 firmware marker is missing.' }
$verification = Get-Content -LiteralPath $verificationPath -Raw | ConvertFrom-Json
if ([DateTime]::Parse($verification.expiresAtUtc).ToUniversalTime() -le [DateTime]::UtcNow) {
  throw 'Verified Stage 2 firmware marker has expired.'
}

[ordered]@{
  scope = 'STAGE2_MAIN_PUMP_SINGLE_PULSE'
  deviceId = 'device001'
  durationMs = 1000
  armedAtUtc = [DateTime]::UtcNow.ToString('o')
  expiresAtUtc = [DateTime]::UtcNow.AddMinutes(5).ToString('o')
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $paths.Secrets 'stage2-main-pump-arm.json') -Encoding UTF8

Write-Output 'One 1000 ms main-pump pulse is armed for five minutes.'
Write-Output 'Run the one-shot tool only while supervising the submerged pump and emergency power cut.'
