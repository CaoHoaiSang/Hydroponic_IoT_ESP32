$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$paths = Get-Stage1Paths
$lanAddress = Get-Stage1LanIPv4
$status = [ordered]@{
  mongoLoopback = Test-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1MongoPort
  mqttLoopback = Test-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1MqttPort
  mqttLan = Test-Stage1TcpPort -HostAddress $lanAddress -Port $Stage1MqttPort
  backendLoopback = Test-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1HttpPort
  lanAddress = $lanAddress
  mqttPort = $Stage1MqttPort
  authenticationRequired = $true
  pumpCommandsDisabled = $true
  stateFile = Test-Path -LiteralPath $paths.StateFile
  firmwareSecretsPresent = Test-Path -LiteralPath $paths.FirmwareSecrets
}
if ($status.backendLoopback) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage1HttpPort/health" -TimeoutSec 2
    $status.service = $health.service
    $status.mongoConnected = $health.mongoConnected
    $status.mqttConnected = $health.mqttConnected
  } catch { $status.healthError = $_.Exception.Message }
}
if ($status.stateFile) {
  $state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
  $status.firmwareWifiConfigured = $state.FirmwareWifiConfigured
}
$status | ConvertTo-Json
