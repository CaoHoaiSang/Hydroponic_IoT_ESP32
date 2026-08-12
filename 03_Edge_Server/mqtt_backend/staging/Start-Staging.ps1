$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage0.Common.ps1')

$paths = Get-Stage0Paths
$started = @()

foreach ($port in @($Stage0MongoPort, $Stage0MqttPort, $Stage0HttpPort)) {
  if (Test-Stage0TcpPort -Port $port) {
    throw "Stage 0 port 127.0.0.1:$port is already in use. Refusing to reuse an unknown service."
  }
}

New-Item -ItemType Directory -Force -Path $paths.MongoData, $paths.Logs | Out-Null

$mongoBinary = Find-Stage0MongoBinary
$mosquittoBinary = Find-Stage0MosquittoBinary
$nodeBinary = (Get-Command node -ErrorAction Stop).Source

try {
  $mongo = Start-Process -FilePath $mongoBinary -WindowStyle Hidden -PassThru -ArgumentList @(
    '--bind_ip', '127.0.0.1',
    '--port', "$Stage0MongoPort",
    '--dbpath', $paths.MongoData,
    '--logpath', (Join-Path $paths.Logs 'mongodb.log'),
    '--logappend'
  )
  $started += [pscustomobject]@{
    Name = 'mongodb-stage0'; Pid = $mongo.Id; Path = $mongoBinary
    StartedAtUtc = $mongo.StartTime.ToUniversalTime().ToString('o')
  }
  Wait-Stage0TcpPort -Port $Stage0MongoPort

  $mosquitto = Start-Process -FilePath $mosquittoBinary -WindowStyle Hidden -PassThru `
    -ArgumentList @('-c', $paths.MosquittoConfig, '-v') `
    -RedirectStandardOutput (Join-Path $paths.Logs 'mosquitto.stdout.log') `
    -RedirectStandardError (Join-Path $paths.Logs 'mosquitto.stderr.log')
  $started += [pscustomobject]@{
    Name = 'mqtt-stage0'; Pid = $mosquitto.Id; Path = $mosquittoBinary
    StartedAtUtc = $mosquitto.StartTime.ToUniversalTime().ToString('o')
  }
  Wait-Stage0TcpPort -Port $Stage0MqttPort

  $stageEnvironment = [ordered]@{
    NODE_ENV = 'staging'
    SERVICE_NAME = 'hydroponic-stage0-backend'
    HTTP_PORT = "$Stage0HttpPort"
    HTTP_HOST = '127.0.0.1'
    CORS_ORIGIN = "http://127.0.0.1:$Stage0HttpPort"
    MONGO_URI = "mongodb://127.0.0.1:$Stage0MongoPort"
    MONGO_DB_NAME = 'hydroponic_stage0'
    MQTT_URL = "mqtt://127.0.0.1:$Stage0MqttPort"
    MQTT_USERNAME = ''
    MQTT_PASSWORD = ''
    MQTT_TOPIC_SENSOR = 'stage0/hydroponic/device001/sensor'
    MQTT_TOPIC_PUMP_CMD = 'stage0/hydroponic/device001/pump/cmd'
    MQTT_TOPIC_PUMP_STATUS = 'stage0/hydroponic/device001/pump/status'
    MQTT_TOPIC_ALERT = 'stage0/hydroponic/device001/alert'
    SHADOW_MODE_ENABLED = 'true'
    PUMP_COMMANDS_DISABLED = 'true'
  }
  $originalEnvironment = @{}
  try {
    foreach ($entry in $stageEnvironment.GetEnumerator()) {
      $originalEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
    $backend = Start-Process -FilePath $nodeBinary -WindowStyle Hidden -PassThru `
      -WorkingDirectory $paths.BackendRoot -ArgumentList @('src/index.js') `
      -RedirectStandardOutput (Join-Path $paths.Logs 'backend.stdout.log') `
      -RedirectStandardError (Join-Path $paths.Logs 'backend.stderr.log')
  } finally {
    foreach ($entry in $originalEnvironment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
  }
  $started += [pscustomobject]@{
    Name = 'backend-stage0'; Pid = $backend.Id; Path = $nodeBinary
    StartedAtUtc = $backend.StartTime.ToUniversalTime().ToString('o')
  }
  Wait-Stage0TcpPort -Port $Stage0HttpPort

  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  do {
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage0HttpPort/health" -TimeoutSec 2
    } catch {
      $health = $null
    }
    if ($health -and $health.mongoConnected -eq $true -and $health.mqttConnected -eq $true) {
      break
    }
    Start-Sleep -Milliseconds 300
  } while ([DateTime]::UtcNow -lt $deadline)
  if (-not $health -or $health.mongoConnected -ne $true -or $health.mqttConnected -ne $true) {
    throw 'Stage 0 backend health did not confirm isolated MongoDB and MQTT connections'
  }

  $state = [pscustomobject]@{
    Stage = 'Phase22B-Stage0'
    StartedAtUtc = [DateTime]::UtcNow.ToString('o')
    MongoUri = "mongodb://127.0.0.1:$Stage0MongoPort"
    Database = 'hydroponic_stage0'
    MqttUrl = "mqtt://127.0.0.1:$Stage0MqttPort"
    HttpUrl = "http://127.0.0.1:$Stage0HttpPort"
    PumpCommandsDisabled = $true
    Processes = $started
  }
  $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

  Write-Output 'Phase 22B Stage 0 started.'
  Write-Output "Dashboard: http://127.0.0.1:$Stage0HttpPort/"
  Write-Output "MongoDB: mongodb://127.0.0.1:$Stage0MongoPort/hydroponic_stage0"
  Write-Output "MQTT: mqtt://127.0.0.1:$Stage0MqttPort"
  Write-Output 'Pump commands: DISABLED'
} catch {
  $reverseStarted = @($started)
  [array]::Reverse($reverseStarted)
  foreach ($item in $reverseStarted) {
    Stop-Process -Id $item.Pid -Force -ErrorAction SilentlyContinue
  }
  throw
}
