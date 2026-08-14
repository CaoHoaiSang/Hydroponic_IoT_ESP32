$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$frontendDir = Join-Path $root '03_Edge_Server\frontend'
$backendDir = Join-Path $root '03_Edge_Server\mqtt_backend'
$dashboardUrl = 'http://127.0.0.1:3001/overview'
$healthUrl = 'http://127.0.0.1:3001/health'

function Write-Step([string]$message) {
  Write-Host "[HydroFlow] $message" -ForegroundColor Cyan
}

function Test-TcpPort([string]$hostName, [int]$port, [int]$timeoutMs = 1200) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $asyncResult = $client.BeginConnect($hostName, $port, $null, $null)
    if (-not $asyncResult.AsyncWaitHandle.WaitOne($timeoutMs)) {
      return $false
    }
    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Get-HydroFlowHealth {
  try {
    return Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  } catch {
    return $null
  }
}

function Invoke-Npm([string]$workingDirectory, [string[]]$arguments) {
  Push-Location $workingDirectory
  try {
    & npm.cmd @arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm $($arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

try {
  Write-Step 'Running local preflight...'

  $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $nodeCommand -or -not $npmCommand) {
    throw 'Node.js 20 or newer is required: https://nodejs.org/'
  }

  $nodeVersionText = (& node.exe --version).TrimStart('v')
  $nodeMajor = [int]($nodeVersionText.Split('.')[0])
  if ($nodeMajor -lt 20) {
    throw "Node.js $nodeVersionText is too old. Install Node.js 20 or newer."
  }
  Write-Host "  Node.js: $nodeVersionText"

  $existingHealth = Get-HydroFlowHealth
  if ($existingHealth) {
    if ($existingHealth.ok -eq $true -and $existingHealth.mongoConnected -eq $true -and $existingHealth.mqttConnected -eq $true) {
      Write-Step 'HydroFlow is already running at http://127.0.0.1:3001'
      Start-Process $dashboardUrl
      exit 0
    }
    throw "HydroFlow Backend is responding but dependencies are not ready (MongoDB=$($existingHealth.mongoConnected), MQTT=$($existingHealth.mqttConnected)). Stop the Backend, restore dependencies, then retry."
  }

  if (Test-TcpPort '127.0.0.1' 3001) {
    throw 'Port 3001 is used by another program. Stop that program, then run this launcher again.'
  }
  if (-not (Test-TcpPort '127.0.0.1' 27017)) {
    throw 'MongoDB is not listening at 127.0.0.1:27017. Start the local MongoDB service first.'
  }
  if (-not (Test-TcpPort '127.0.0.1' 1883)) {
    throw 'Mosquitto MQTT is not listening at 127.0.0.1:1883. Start the local Mosquitto service first.'
  }
  Write-Host '  MongoDB: 127.0.0.1:27017 OK'
  Write-Host '  MQTT:    127.0.0.1:1883 OK'

  $frontendTsc = Join-Path $frontendDir 'node_modules\.bin\tsc.cmd'
  $frontendVite = Join-Path $frontendDir 'node_modules\.bin\vite.cmd'
  if (-not (Test-Path $frontendTsc) -or -not (Test-Path $frontendVite)) {
    if (Test-TcpPort '127.0.0.1' 5173) {
      throw 'Frontend dependencies are incomplete while port 5173 is active. Close the START_FRONTEND_ONLY window, then retry.'
    }
    Write-Step 'Installing or repairing frontend dependencies...'
    Invoke-Npm $frontendDir @('ci')
  }
  Write-Step 'Building the HydroFlow frontend...'
  Invoke-Npm $frontendDir @('run', 'build')

  $backendReady = (Test-Path (Join-Path $backendDir 'node_modules\express\package.json')) `
    -and (Test-Path (Join-Path $backendDir 'node_modules\mongodb\package.json')) `
    -and (Test-Path (Join-Path $backendDir 'node_modules\mqtt\package.json'))
  if (-not $backendReady) {
    Write-Step 'Installing or repairing backend dependencies...'
    Invoke-Npm $backendDir @('ci')
  }

  # This launcher is deliberately local and fail-closed.
  $env:HTTP_HOST = '127.0.0.1'
  $env:HTTP_PORT = '3001'
  $env:MONGO_URI = 'mongodb://127.0.0.1:27017'
  $env:MONGO_DB_NAME = 'hydroponic_iot'
  $env:MQTT_URL = 'mqtt://127.0.0.1:1883'
  $env:MQTT_USERNAME = ''
  $env:MQTT_PASSWORD = ''
  $env:SYSTEM_BUILD_PROFILE = 'LOCAL_UI_SAFE'
  $env:CAPABILITY_METADATA_VERIFIED = 'false'
  $env:ACTUATORS_LOCKED = 'true'
  $env:PUMP_COMMANDS_DISABLED = 'true'
  $env:SHADOW_MODE_ENABLED = 'false'

  Write-Host ''
  Write-Host '  Dashboard: http://127.0.0.1:3001/overview' -ForegroundColor Green
  Write-Host '  Safety: Pump commands locked, Auto Dosing OFF' -ForegroundColor Yellow
  Write-Host '  Stop: press Ctrl+C in this window' -ForegroundColor DarkGray
  Write-Host ''

  $browserJob = $null
  if ($env:HYDROFLOW_NO_BROWSER -ne '1') {
    $browserJob = Start-Job -ScriptBlock {
      param($url, $health)
      for ($attempt = 0; $attempt -lt 60; $attempt += 1) {
        try {
          $response = Invoke-RestMethod -Uri $health -TimeoutSec 1
          if ($response.ok -eq $true -and $response.mongoConnected -eq $true -and $response.mqttConnected -eq $true) {
            Start-Process $url
            return
          }
        } catch {
          Start-Sleep -Milliseconds 500
        }
      }
    } -ArgumentList $dashboardUrl, $healthUrl
  }

  Push-Location $backendDir
  try {
    & npm.cmd start
    $backendExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
    if ($browserJob) {
      Stop-Job $browserJob -ErrorAction SilentlyContinue
      Remove-Job $browserJob -Force -ErrorAction SilentlyContinue
    }
  }

  if ($backendExitCode -ne 0) {
    throw "Backend stopped with exit code $backendExitCode"
  }
  exit 0
} catch {
  Write-Host ''
  Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ''
  Write-Host 'Quick checks:' -ForegroundColor Yellow
  Write-Host '  1. Open services.msc and start MongoDB.'
  Write-Host '  2. Open services.msc and start Mosquitto.'
  Write-Host '  3. Ensure port 3001 is free.'
  Write-Host '  4. Close START_FRONTEND_ONLY if port 5173 is active during dependency repair.'
  Write-Host '  5. Run START_FULL_LOCAL.bat again.'
  exit 1
}
