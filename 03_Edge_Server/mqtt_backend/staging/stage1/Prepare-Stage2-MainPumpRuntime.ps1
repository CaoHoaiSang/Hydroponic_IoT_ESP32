param(
  [Parameter(Mandatory)]
  [string]$Confirmation
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$requiredConfirmation = 'CONFIRM STAGE2 PREPARE WITH 12V OFF'
if ($Confirmation -cne $requiredConfirmation) {
  throw "Exact confirmation required: $requiredConfirmation"
}

$paths = Get-Stage1Paths
& (Get-Command node -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'checkStage2ActuatorReadiness.js')
if ($LASTEXITCODE -ne 0) { throw 'Read-only Stage 2 readiness preflight did not pass.' }

$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$credentials = Get-Content -LiteralPath $paths.CredentialsFile -Raw | ConvertFrom-Json
if (-not $credentials.PSObject.Properties['operator']) {
  $credentials | Add-Member -NotePropertyName operator -NotePropertyValue ([pscustomobject]@{
    username = 'stage2_main_operator'
    password = New-Stage1Secret
  })
  $credentials | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $paths.CredentialsFile -Encoding UTF8
}

$passwordBinary = Find-Stage1MosquittoBinary -Name 'mosquitto_passwd.exe'
if (Test-Path -LiteralPath $paths.PasswordFile) { Remove-Item -LiteralPath $paths.PasswordFile -Force }
& $passwordBinary -b -c $paths.PasswordFile $credentials.backend.username $credentials.backend.password | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to create Stage 2 password file.' }
foreach ($account in @($credentials.device, $credentials.auditor, $credentials.operator)) {
  & $passwordBinary -b $paths.PasswordFile $account.username $account.password | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to append a Stage 2 runtime account.' }
}

@"
user $($credentials.backend.username)
topic read stage1/hydroponic/device001/sensor
topic read stage1/hydroponic/device001/pump/status

user $($credentials.device.username)
topic write stage1/hydroponic/device001/sensor
topic write stage1/hydroponic/device001/pump/status
topic read stage1/hydroponic/device001/pump/cmd

user $($credentials.auditor.username)
topic read stage1/hydroponic/device001/#
topic write stage1/hydroponic/device001/sensor

user $($credentials.operator.username)
topic write stage1/hydroponic/device001/pump/cmd
"@ | Set-Content -LiteralPath $paths.AclFile -Encoding ASCII

$brokerState = @($state.Processes | Where-Object { $_.Name -eq 'mqtt-stage1' })[0]
if (-not $brokerState) { throw 'Stage 1 broker process state was not found.' }
$brokerProcess = Get-Process -Id $brokerState.Pid -ErrorAction Stop
$expectedStart = [DateTime]::Parse($brokerState.StartedAtUtc).ToUniversalTime()
if (($brokerProcess.Path -ne $brokerState.Path) -or
    ([Math]::Abs(($brokerProcess.StartTime.ToUniversalTime() - $expectedStart).TotalSeconds) -gt 1)) {
  throw 'Refused to restart broker because its process identity does not match.'
}

Stop-Process -Id $brokerProcess.Id -Force
$brokerProcess.WaitForExit(10000) | Out-Null
$mosquitto = Start-Process -FilePath (Find-Stage1MosquittoBinary) -WindowStyle Hidden -PassThru `
  -ArgumentList @('-c', $paths.MosquittoConfig, '-v') `
  -RedirectStandardOutput (Join-Path $paths.Logs 'mosquitto.stdout.log') `
  -RedirectStandardError (Join-Path $paths.Logs 'mosquitto.stderr.log')

$lanAddress = [string]$state.LanAddress
Wait-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1MqttPort
Wait-Stage1TcpPort -HostAddress $lanAddress -Port $Stage1MqttPort
$brokerState.Pid = $mosquitto.Id
$brokerState.Path = $mosquitto.Path
$brokerState.StartedAtUtc = $mosquitto.StartTime.ToUniversalTime().ToString('o')
$state | Add-Member -NotePropertyName Stage2MainPumpOperatorPrepared -NotePropertyValue $true -Force
$state | Add-Member -NotePropertyName Stage2PreparedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

$deadline = [DateTime]::UtcNow.AddSeconds(20)
do {
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage1HttpPort/health" -TimeoutSec 2 } catch { $health = $null }
  if ($health -and $health.mongoConnected -eq $true -and $health.mqttConnected -eq $true) { break }
  Start-Sleep -Milliseconds 300
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $health -or $health.mongoConnected -ne $true -or $health.mqttConnected -ne $true) {
  throw 'Backend did not reconnect after Stage 2 broker preparation.'
}

Write-Output 'Stage 2 main-pump runtime prepared.'
Write-Output 'Backend publisher remains disabled; Auto Dosing remains locked OFF.'
Write-Output 'Operator may write only the isolated pump-command topic.'
Write-Output 'No MQTT command was published. Physical gate remains closed.'
