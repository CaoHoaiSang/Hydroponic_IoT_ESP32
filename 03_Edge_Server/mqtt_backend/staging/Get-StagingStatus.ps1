$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage0.Common.ps1')

$paths = Get-Stage0Paths
$status = [ordered]@{
  mongo = Test-Stage0TcpPort -Port $Stage0MongoPort
  mqtt = Test-Stage0TcpPort -Port $Stage0MqttPort
  backend = Test-Stage0TcpPort -Port $Stage0HttpPort
  stateFile = Test-Path -LiteralPath $paths.StateFile
  pumpCommandsDisabled = $null
}
if ($status.backend) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage0HttpPort/health" -TimeoutSec 2
    $status.service = $health.service
    $status.mongoConnected = $health.mongoConnected
    $status.mqttConnected = $health.mqttConnected
  } catch {
    $status.healthError = $_.Exception.Message
  }
}
if ($status.stateFile) {
  $state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
  $status.pumpCommandsDisabled = $state.PumpCommandsDisabled
}
$status | ConvertTo-Json
