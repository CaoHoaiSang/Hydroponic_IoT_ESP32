Set-StrictMode -Version Latest

$script:Stage0MongoPort = 27018
$script:Stage0MqttPort = 18884
$script:Stage0HttpPort = 3100

function Get-Stage0Paths {
  $backendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
  $runtimeRoot = Join-Path $PSScriptRoot '.stage0_runtime'

  return [pscustomobject]@{
    BackendRoot = $backendRoot
    RuntimeRoot = $runtimeRoot
    MongoData = Join-Path $runtimeRoot 'mongodb'
    Logs = Join-Path $runtimeRoot 'logs'
    StateFile = Join-Path $runtimeRoot 'processes.json'
    MosquittoConfig = Join-Path $PSScriptRoot 'mosquitto.stage0.conf'
  }
}

function Test-Stage0TcpPort {
  param([Parameter(Mandatory)][int]$Port)

  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    return $task.Wait(250) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-Stage0TcpPort {
  param(
    [Parameter(Mandatory)][int]$Port,
    [int]$TimeoutSec = 30
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
  while ([DateTime]::UtcNow -lt $deadline) {
    if (Test-Stage0TcpPort -Port $Port) {
      return
    }
    Start-Sleep -Milliseconds 250
  }
  throw "Stage 0 service did not listen on 127.0.0.1:$Port within $TimeoutSec seconds"
}

function Find-Stage0MongoBinary {
  $serverRoot = Join-Path $env:ProgramFiles 'MongoDB\Server'
  $binary = Get-ChildItem -LiteralPath $serverRoot -Filter mongod.exe -Recurse -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if (-not $binary) {
    throw 'mongod.exe was not found under Program Files\MongoDB\Server'
  }
  return $binary.FullName
}

function Find-Stage0MosquittoBinary {
  $binary = Join-Path $env:ProgramFiles 'Mosquitto\mosquitto.exe'
  if (-not (Test-Path -LiteralPath $binary)) {
    throw 'mosquitto.exe was not found under Program Files\Mosquitto'
  }
  return $binary
}
