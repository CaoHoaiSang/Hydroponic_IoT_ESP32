$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$paths = Get-Stage1Paths
if (-not (Test-Path -LiteralPath $paths.StateFile)) {
  throw 'Stage 1 runtime state was not found.'
}

$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$backendState = @($state.Processes | Where-Object { $_.Name -eq 'backend-stage1' })[0]
if (-not $backendState) { throw 'Stage 1 backend process state was not found.' }

$backendProcess = Get-Process -Id $backendState.Pid -ErrorAction Stop
$expectedStart = [DateTime]::Parse($backendState.StartedAtUtc).ToUniversalTime()
if (($backendProcess.Path -ne $backendState.Path) -or ([Math]::Abs(($backendProcess.StartTime.ToUniversalTime() - $expectedStart).TotalSeconds) -gt 1)) {
  throw 'Refused to restart Stage 1 backend because process identity does not match.'
}

$credentials = Get-Content -LiteralPath $paths.CredentialsFile -Raw | ConvertFrom-Json
$stageEnvironment = [ordered]@{
  NODE_ENV='staging'; SERVICE_NAME='hydroponic-stage1-preflight-backend'
  HTTP_PORT="$Stage1HttpPort"; HTTP_HOST='127.0.0.1'; CORS_ORIGIN="http://127.0.0.1:$Stage1HttpPort"
  MONGO_URI="mongodb://127.0.0.1:$Stage1MongoPort"; MONGO_DB_NAME=$Stage1DatabaseName
  MQTT_URL="mqtt://127.0.0.1:$Stage1MqttPort"
  MQTT_USERNAME=$credentials.backend.username; MQTT_PASSWORD=$credentials.backend.password
  MQTT_TOPIC_SENSOR='stage1/hydroponic/device001/sensor'
  MQTT_TOPIC_PUMP_CMD='stage1/hydroponic/device001/pump/cmd'
  MQTT_TOPIC_PUMP_STATUS='stage1/hydroponic/device001/pump/status'
  MQTT_TOPIC_ALERT='stage1/hydroponic/device001/alert'
  SHADOW_MODE_ENABLED='true'; PUMP_COMMANDS_DISABLED='true'
}

Stop-Process -Id $backendProcess.Id -Force
$backendProcess.WaitForExit(10000) | Out-Null

$originalEnvironment = @{}
try {
  foreach ($entry in $stageEnvironment.GetEnumerator()) {
    $originalEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
  $backend = Start-Process -FilePath (Get-Command node -ErrorAction Stop).Source -WindowStyle Hidden -PassThru `
    -WorkingDirectory $paths.BackendRoot -ArgumentList @('src/index.js') `
    -RedirectStandardOutput (Join-Path $paths.Logs 'backend.stdout.log') `
    -RedirectStandardError (Join-Path $paths.Logs 'backend.stderr.log')
} finally {
  foreach ($entry in $originalEnvironment.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
}

$backendState.Pid = $backend.Id
$backendState.Path = $backend.Path
$backendState.StartedAtUtc = $backend.StartTime.ToUniversalTime().ToString('o')
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

$deadline = [DateTime]::UtcNow.AddSeconds(20)
do {
  try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage1HttpPort/health" -TimeoutSec 2 } catch { $health = $null }
  if ($health -and $health.mongoConnected -eq $true -and $health.mqttConnected -eq $true) { break }
  Start-Sleep -Milliseconds 300
} while ([DateTime]::UtcNow -lt $deadline)

if (-not $health -or $health.mongoConnected -ne $true -or $health.mqttConnected -ne $true) {
  throw 'Restarted Stage 1 backend health check failed.'
}

Write-Output 'Stage 1 backend restarted; MongoDB and MQTT connections are healthy.'
