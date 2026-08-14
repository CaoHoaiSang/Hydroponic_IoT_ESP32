$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$paths = Get-Stage1Paths
$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$credentials = Get-Content -LiteralPath $paths.CredentialsFile -Raw | ConvertFrom-Json

@"
user $($credentials.backend.username)
topic read stage1/hydroponic/device001/sensor
topic read stage1/hydroponic/device001/pump/status

user $($credentials.device.username)
topic write stage1/hydroponic/device001/sensor
topic write stage1/hydroponic/device001/pump/status

user $($credentials.auditor.username)
topic read stage1/hydroponic/device001/#
topic write stage1/hydroponic/device001/sensor
"@ | Set-Content -LiteralPath $paths.AclFile -Encoding ASCII

Remove-Item -LiteralPath (Join-Path $paths.Secrets 'stage2-main-pump-arm.json') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $paths.Secrets 'stage2-firmware-verified.json') -Force -ErrorAction SilentlyContinue

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
$state | Add-Member -NotePropertyName Stage2MainPumpOperatorPrepared -NotePropertyValue $false -Force
$state | Add-Member -NotePropertyName Stage2DisabledAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

$deadline = [DateTime]::UtcNow.AddSeconds(20)
do {
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage1HttpPort/health" -TimeoutSec 2 } catch { $health = $null }
  if ($health -and $health.mongoConnected -eq $true -and $health.mqttConnected -eq $true) { break }
  Start-Sleep -Milliseconds 300
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $health -or $health.mongoConnected -ne $true -or $health.mqttConnected -ne $true) {
  throw 'Backend did not reconnect after Stage 2 runtime disable.'
}

Write-Output 'Stage 2 MQTT operator path disabled.'
Write-Output 'Arm and firmware verification markers removed; backend and Auto Dosing remain locked.'
