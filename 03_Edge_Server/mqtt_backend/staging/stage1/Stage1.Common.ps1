Set-StrictMode -Version Latest

$script:Stage1MongoPort = 27019
$script:Stage1MqttPort = 18885
$script:Stage1HttpPort = 3101
$script:Stage1DatabaseName = 'hydroponic_stage1_preflight'
$script:Stage1FirewallRule = 'Hydroponic Phase22B Stage1 MQTT'

function Get-Stage1Paths {
  $backendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
  $projectRoot = [IO.Path]::GetFullPath((Join-Path $backendRoot '..\..'))
  $runtimeRoot = Join-Path $PSScriptRoot '.stage1_runtime'
  return [pscustomobject]@{
    BackendRoot = $backendRoot
    ProjectRoot = $projectRoot
    RuntimeRoot = $runtimeRoot
    MongoData = Join-Path $runtimeRoot 'mongodb'
    Logs = Join-Path $runtimeRoot 'logs'
    Secrets = Join-Path $runtimeRoot 'secrets'
    CredentialsFile = Join-Path $runtimeRoot 'secrets\credentials.json'
    PasswordFile = Join-Path $runtimeRoot 'secrets\mosquitto.passwd'
    AclFile = Join-Path $runtimeRoot 'mosquitto.stage1.acl'
    MosquittoConfig = Join-Path $runtimeRoot 'mosquitto.stage1.conf'
    StateFile = Join-Path $runtimeRoot 'processes.json'
    FirmwareSecrets = Join-Path $projectRoot '02_ESP32_Main_Firmware\Hydroponic_Device001\SecretsStage1.h'
  }
}

function Get-Stage1LanIPv4 {
  $candidate = Get-NetIPConfiguration |
    Where-Object { $_.NetAdapter.Status -eq 'Up' -and $_.IPv4DefaultGateway -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|Bluetooth' } |
    ForEach-Object { $_.IPv4Address } |
    Where-Object { $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' } |
    Select-Object -First 1
  if (-not $candidate) {
    throw 'No active private LAN IPv4 address with a default gateway was found.'
  }
  return $candidate.IPAddress
}

function Test-Stage1TcpPort {
  param([Parameter(Mandatory)][string]$HostAddress, [Parameter(Mandatory)][int]$Port)
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($HostAddress, $Port)
    return $task.Wait(500) -and $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Wait-Stage1TcpPort {
  param([Parameter(Mandatory)][string]$HostAddress, [Parameter(Mandatory)][int]$Port, [int]$TimeoutSec = 30)
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-Stage1TcpPort -HostAddress $HostAddress -Port $Port) { return }
    Start-Sleep -Milliseconds 250
  }
  throw "Stage 1 service did not listen on ${HostAddress}:$Port within $TimeoutSec seconds"
}

function Find-Stage1MongoBinary {
  $binary = Get-ChildItem -LiteralPath (Join-Path $env:ProgramFiles 'MongoDB\Server') -Filter mongod.exe -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
  if (-not $binary) { throw 'mongod.exe was not found under Program Files\MongoDB\Server' }
  return $binary.FullName
}

function Find-Stage1MosquittoBinary {
  param([string]$Name = 'mosquitto.exe')
  $binary = Join-Path $env:ProgramFiles "Mosquitto\$Name"
  if (-not (Test-Path -LiteralPath $binary)) { throw "$Name was not found under Program Files\Mosquitto" }
  return $binary
}

function New-Stage1Secret {
  $bytes = [byte[]]::new(32)
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function ConvertTo-Stage1CString {
  param([Parameter(Mandatory)][string]$Value)
  return $Value.Replace('\', '\\').Replace('"', '\"')
}
