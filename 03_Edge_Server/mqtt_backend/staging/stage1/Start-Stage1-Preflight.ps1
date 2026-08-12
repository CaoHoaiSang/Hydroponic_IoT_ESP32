$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$paths = Get-Stage1Paths
$lanAddress = Get-Stage1LanIPv4
$started = @()
$firewallCreated = $false

foreach ($endpoint in @(
  @{ Host = '127.0.0.1'; Port = $Stage1MongoPort },
  @{ Host = '127.0.0.1'; Port = $Stage1MqttPort },
  @{ Host = $lanAddress; Port = $Stage1MqttPort },
  @{ Host = '127.0.0.1'; Port = $Stage1HttpPort }
)) {
  if (Test-Stage1TcpPort -HostAddress $endpoint.Host -Port $endpoint.Port) {
    throw "Stage 1 endpoint $($endpoint.Host):$($endpoint.Port) is already in use."
  }
}

New-Item -ItemType Directory -Force -Path $paths.MongoData, $paths.Logs, $paths.Secrets | Out-Null
$mongoBinary = Find-Stage1MongoBinary
$mosquittoBinary = Find-Stage1MosquittoBinary
$passwordBinary = Find-Stage1MosquittoBinary -Name 'mosquitto_passwd.exe'
$nodeBinary = (Get-Command node -ErrorAction Stop).Source

try {
  if (-not (Test-Path -LiteralPath $paths.CredentialsFile)) {
    [ordered]@{
      backend = [ordered]@{ username = 'stage1_backend'; password = New-Stage1Secret }
      device = [ordered]@{ username = 'stage1_device'; password = New-Stage1Secret }
      auditor = [ordered]@{ username = 'stage1_auditor'; password = New-Stage1Secret }
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $paths.CredentialsFile -Encoding UTF8
  }
  $credentials = Get-Content -LiteralPath $paths.CredentialsFile -Raw | ConvertFrom-Json

  if (Test-Path -LiteralPath $paths.PasswordFile) { Remove-Item -LiteralPath $paths.PasswordFile -Force }
  & $passwordBinary -b -c $paths.PasswordFile $credentials.backend.username $credentials.backend.password | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Stage 1 password file' }
  foreach ($account in @($credentials.device, $credentials.auditor)) {
    & $passwordBinary -b $paths.PasswordFile $account.username $account.password | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Failed to append Stage 1 password account' }
  }

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

  $passwordPath = $paths.PasswordFile.Replace('\', '/')
  $aclPath = $paths.AclFile.Replace('\', '/')
  @"
per_listener_settings false
allow_anonymous false
password_file $passwordPath
acl_file $aclPath
listener $Stage1MqttPort 127.0.0.1
listener $Stage1MqttPort $lanAddress
"@ | Set-Content -LiteralPath $paths.MosquittoConfig -Encoding ASCII

  Get-NetFirewallRule -DisplayName $Stage1FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName $Stage1FirewallRule -Direction Inbound -Action Allow -Protocol TCP `
    -LocalAddress $lanAddress -LocalPort $Stage1MqttPort -RemoteAddress LocalSubnet `
    -Program $mosquittoBinary -Profile Any | Out-Null
  $firewallCreated = $true

  $mongo = Start-Process -FilePath $mongoBinary -WindowStyle Hidden -PassThru -ArgumentList @(
    '--bind_ip', '127.0.0.1', '--port', "$Stage1MongoPort", '--dbpath', $paths.MongoData,
    '--logpath', (Join-Path $paths.Logs 'mongodb.log'), '--logappend'
  )
  $started += [pscustomobject]@{ Name='mongodb-stage1'; Pid=$mongo.Id; Path=$mongoBinary; StartedAtUtc=$mongo.StartTime.ToUniversalTime().ToString('o') }
  Wait-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1MongoPort

  $mosquitto = Start-Process -FilePath $mosquittoBinary -WindowStyle Hidden -PassThru -ArgumentList @('-c', $paths.MosquittoConfig, '-v') `
    -RedirectStandardOutput (Join-Path $paths.Logs 'mosquitto.stdout.log') `
    -RedirectStandardError (Join-Path $paths.Logs 'mosquitto.stderr.log')
  $started += [pscustomobject]@{ Name='mqtt-stage1'; Pid=$mosquitto.Id; Path=$mosquittoBinary; StartedAtUtc=$mosquitto.StartTime.ToUniversalTime().ToString('o') }
  Wait-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1MqttPort
  Wait-Stage1TcpPort -HostAddress $lanAddress -Port $Stage1MqttPort

  $stageEnvironment = [ordered]@{
    NODE_ENV='staging'; SERVICE_NAME='hydroponic-stage1-preflight-backend'; HTTP_PORT="$Stage1HttpPort"; HTTP_HOST='127.0.0.1'
    CORS_ORIGIN="http://127.0.0.1:$Stage1HttpPort"; MONGO_URI="mongodb://127.0.0.1:$Stage1MongoPort"; MONGO_DB_NAME=$Stage1DatabaseName
    MQTT_URL="mqtt://127.0.0.1:$Stage1MqttPort"; MQTT_USERNAME=$credentials.backend.username; MQTT_PASSWORD=$credentials.backend.password
    MQTT_TOPIC_SENSOR='stage1/hydroponic/device001/sensor'; MQTT_TOPIC_PUMP_CMD='stage1/hydroponic/device001/pump/cmd'
    MQTT_TOPIC_PUMP_STATUS='stage1/hydroponic/device001/pump/status'; MQTT_TOPIC_ALERT='stage1/hydroponic/device001/alert'
    SHADOW_MODE_ENABLED='true'; PUMP_COMMANDS_DISABLED='true'
  }
  $originalEnvironment = @{}
  try {
    foreach ($entry in $stageEnvironment.GetEnumerator()) {
      $originalEnvironment[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key, 'Process')
      [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
    $backend = Start-Process -FilePath $nodeBinary -WindowStyle Hidden -PassThru -WorkingDirectory $paths.BackendRoot -ArgumentList @('src/index.js') `
      -RedirectStandardOutput (Join-Path $paths.Logs 'backend.stdout.log') `
      -RedirectStandardError (Join-Path $paths.Logs 'backend.stderr.log')
  } finally {
    foreach ($entry in $originalEnvironment.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
  }
  $started += [pscustomobject]@{ Name='backend-stage1'; Pid=$backend.Id; Path=$nodeBinary; StartedAtUtc=$backend.StartTime.ToUniversalTime().ToString('o') }
  Wait-Stage1TcpPort -HostAddress '127.0.0.1' -Port $Stage1HttpPort

  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  do {
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Stage1HttpPort/health" -TimeoutSec 2 } catch { $health = $null }
    if ($health -and $health.mongoConnected -eq $true -and $health.mqttConnected -eq $true) { break }
    Start-Sleep -Milliseconds 300
  } while ([DateTime]::UtcNow -lt $deadline)
  if (-not $health -or $health.mongoConnected -ne $true -or $health.mqttConnected -ne $true) { throw 'Stage 1 backend health failed' }

  $wifiConfigured = -not [string]::IsNullOrWhiteSpace($env:STAGE1_WIFI_SSID) -and -not [string]::IsNullOrWhiteSpace($env:STAGE1_WIFI_PASSWORD)
  $wifiSsid = if ($wifiConfigured) { $env:STAGE1_WIFI_SSID } else { 'SET_STAGE1_WIFI_SSID_BEFORE_FLASH' }
  $wifiPassword = if ($wifiConfigured) { $env:STAGE1_WIFI_PASSWORD } else { 'SET_STAGE1_WIFI_PASSWORD_BEFORE_FLASH' }
  @"
#ifndef SECRETS_STAGE1_H
#define SECRETS_STAGE1_H
#define WIFI_SSID "$(ConvertTo-Stage1CString $wifiSsid)"
#define WIFI_PASSWORD "$(ConvertTo-Stage1CString $wifiPassword)"
#define MQTT_HOST "$lanAddress"
#define MQTT_PORT $Stage1MqttPort
#define MQTT_USERNAME "$(ConvertTo-Stage1CString $credentials.device.username)"
#define MQTT_PASSWORD "$(ConvertTo-Stage1CString $credentials.device.password)"
#endif
"@ | Set-Content -LiteralPath $paths.FirmwareSecrets -Encoding ASCII

  [pscustomobject]@{
    Stage='Phase22B-Stage1-Preflight'; StartedAtUtc=[DateTime]::UtcNow.ToString('o'); LanAddress=$lanAddress
    MongoUri="mongodb://127.0.0.1:$Stage1MongoPort"; Database=$Stage1DatabaseName
    MqttLoopbackUrl="mqtt://127.0.0.1:$Stage1MqttPort"; MqttLanUrl="mqtt://${lanAddress}:$Stage1MqttPort"
    HttpUrl="http://127.0.0.1:$Stage1HttpPort"; Authentication=$true; PumpCommandsDisabled=$true
    FirmwareWifiConfigured=$wifiConfigured; Processes=$started
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

  Write-Output 'Phase 22B Stage 1 preflight started.'
  Write-Output "MQTT listeners: 127.0.0.1:$Stage1MqttPort and ${lanAddress}:$Stage1MqttPort"
  Write-Output "Dashboard: http://127.0.0.1:$Stage1HttpPort/"
  Write-Output 'Authentication: REQUIRED; pump command publishing: DISABLED'
  Write-Output "Firmware Wi-Fi secret configured: $wifiConfigured"
} catch {
  $reverse = @($started); [array]::Reverse($reverse)
  foreach ($item in $reverse) { Stop-Process -Id $item.Pid -Force -ErrorAction SilentlyContinue }
  if ($firewallCreated) { Get-NetFirewallRule -DisplayName $Stage1FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule }
  throw
}
