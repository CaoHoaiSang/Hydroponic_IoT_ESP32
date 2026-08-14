param(
  [ValidateRange(1, 30)]
  [int]$DurationMinutes = 5,
  [string]$DeviceId = 'device001'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Stage1TdsRecoveryExecutionState {
  [DllImport("kernel32.dll")]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@

$esContinuous = [uint32]::Parse('80000000', [Globalization.NumberStyles]::HexNumber)
$esSystemRequired = [uint32]0x00000001
$keepAwakeResult = [Stage1TdsRecoveryExecutionState]::SetThreadExecutionState($esContinuous -bor $esSystemRequired)
if ($keepAwakeResult -eq 0) { throw 'Failed to prevent Windows standby for the TDS recovery check.' }

try {
  $apiRoot = "http://127.0.0.1:$Stage1HttpPort"
  $paths = Get-Stage1Paths
  $brokerLog = Join-Path $paths.Logs 'mosquitto.stderr.log'
  $startedAtUtc = [DateTime]::UtcNow
  $startedLatest = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/latest").latest
  $startSequence = [int]$startedLatest.measurementSeq
  $startBootId = [string]$startedLatest.bootId
  $startReceivedAt = [DateTimeOffset]::Parse([string]$startedLatest.receivedAt).ToUniversalTime()
  $startAgeSec = ([DateTimeOffset]::UtcNow - $startReceivedAt).TotalSeconds
  if ($startAgeSec -lt -5 -or $startAgeSec -gt 45) {
    throw "Initial telemetry is stale or future-dated (ageSec=$([Math]::Round($startAgeSec, 2)))."
  }
  if ($startedLatest.tdsControlValid -ne $true) {
    throw 'Initial telemetry is not TDS control-valid.'
  }
  if ($startedLatest.pumpMain -or $startedLatest.pumpA -or $startedLatest.pumpB) {
    throw 'Initial telemetry reports at least one pump ON.'
  }
  $startRuns = Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/auto-dosing/runs?limit=100"
  $brokerStartLineCount = if (Test-Path -LiteralPath $brokerLog) {
    @(Get-Content -LiteralPath $brokerLog).Count
  } else { 0 }

  Start-Sleep -Seconds ($DurationMinutes * 60)

  $endedAtUtc = [DateTime]::UtcNow
  $health = Invoke-RestMethod "$apiRoot/health"
  $latest = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/latest").latest
  $settings = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/auto-dosing/settings").data
  $activeRun = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/auto-dosing/active-run").data
  $endRuns = Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/auto-dosing/runs?limit=100"
  if ([string]$latest.bootId -ne $startBootId) {
    throw "ESP32 boot changed during the TDS recovery check ($startBootId -> $($latest.bootId))."
  }
  $logs = @((Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/sensor-logs?limit=100").data |
    Where-Object {
      $_.bootId -eq $startBootId -and
      [int]$_.measurementSeq -gt $startSequence
    } | Sort-Object measurementSeq)
  if ($logs.Count -eq 0) { throw 'No telemetry was received during the TDS recovery check.' }

  $intervals = @()
  for ($index = 1; $index -lt $logs.Count; $index++) {
    $currentReceivedAt = [DateTimeOffset]::Parse([string]$logs[$index].receivedAt).ToUniversalTime()
    $previousReceivedAt = [DateTimeOffset]::Parse([string]$logs[$index - 1].receivedAt).ToUniversalTime()
    $intervals += ($currentReceivedAt - $previousReceivedAt).TotalSeconds
  }

  $expectedSequenceCount = [int]$logs[-1].measurementSeq - [int]$logs[0].measurementSeq + 1
  $fullSpreads = @($logs | ForEach-Object { [double]$_.tdsSpreadRaw })
  $robustSpreads = @($logs | ForEach-Object { [double]$_.tdsRobustSpreadRaw })
  $ppmValues = @($logs | Where-Object { $null -ne $_.tdsPpm } | ForEach-Object { [double]$_.tdsPpm })
  $averagePpm = if ($ppmValues.Count) { ($ppmValues | Measure-Object -Average).Average } else { $null }
  $ppmVariance = if ($ppmValues.Count) {
    (($ppmValues | ForEach-Object { [Math]::Pow($_ - $averagePpm, 2) } | Measure-Object -Average).Average)
  } else { $null }
  $newBrokerLines = if (Test-Path -LiteralPath $brokerLog) {
    @(Get-Content -LiteralPath $brokerLog | Select-Object -Skip $brokerStartLineCount)
  } else { @() }
  $pumpCommandLines = @($newBrokerLines | Select-String "Received PUBLISH .*'stage1/hydroponic/device001/pump/cmd'")
  $connectionEventLines = @($newBrokerLines | Select-String 'New connection|New client connected|disconnected|timed out|Socket error')
  $latestReceivedAt = [DateTimeOffset]::Parse([string]$latest.receivedAt).ToUniversalTime()
  $latestAgeSec = ([DateTimeOffset]::UtcNow - $latestReceivedAt).TotalSeconds

  $result = [ordered]@{
    scope = 'READ_ONLY_STAGE1_TDS_RECOVERY'
    startedAtUtc = $startedAtUtc.ToString('o')
    endedAtUtc = $endedAtUtc.ToString('o')
    durationMinutes = [Math]::Round(($endedAtUtc - $startedAtUtc).TotalMinutes, 2)
    deviceId = $DeviceId
    bootId = $startBootId
    activeCalibrationSetId = [string]$latest.tdsCalibrationSetId
    startSequence = $startSequence
    firstSequence = [int]$logs[0].measurementSeq
    lastSequence = [int]$logs[-1].measurementSeq
    measurementCount = $logs.Count
    sequenceContiguous = $expectedSequenceCount -eq $logs.Count
    distinctBootCount = @($logs.bootId | Sort-Object -Unique).Count
    allAccepted = @($logs | Where-Object { $_.telemetryOrderStatus -ne 'ACCEPTED' }).Count -eq 0
    allWindowStable = @($logs | Where-Object { $_.tdsWindowStable -ne $true }).Count -eq 0
    allTdsStable = @($logs | Where-Object { $_.tdsStable -ne $true }).Count -eq 0
    allControlValid = @($logs | Where-Object { $_.tdsControlValid -ne $true }).Count -eq 0
    allCalibrationInRange = @($logs | Where-Object { $_.tdsCalibrationInRange -ne $true }).Count -eq 0
    nullTdsPpmCount = @($logs | Where-Object { $null -eq $_.tdsPpm }).Count
    controlInvalidMeasurementCount = @($logs | Where-Object { @($_.tdsControlInvalidReasons).Count -gt 0 }).Count
    fullSpreadMin = ($fullSpreads | Measure-Object -Minimum).Minimum
    fullSpreadAverage = [Math]::Round(($fullSpreads | Measure-Object -Average).Average, 2)
    fullSpreadMax = ($fullSpreads | Measure-Object -Maximum).Maximum
    robustSpreadMin = ($robustSpreads | Measure-Object -Minimum).Minimum
    robustSpreadAverage = [Math]::Round(($robustSpreads | Measure-Object -Average).Average, 2)
    robustSpreadMax = ($robustSpreads | Measure-Object -Maximum).Maximum
    ppmMin = if ($ppmValues.Count) { ($ppmValues | Measure-Object -Minimum).Minimum } else { $null }
    ppmAverage = if ($ppmValues.Count) { [Math]::Round($averagePpm, 2) } else { $null }
    ppmMax = if ($ppmValues.Count) { ($ppmValues | Measure-Object -Maximum).Maximum } else { $null }
    ppmStdDev = if ($ppmValues.Count) { [Math]::Round([Math]::Sqrt($ppmVariance), 2) } else { $null }
    intervalAverageSec = if ($intervals.Count) { [Math]::Round(($intervals | Measure-Object -Average).Average, 2) } else { $null }
    intervalMaxSec = if ($intervals.Count) { [Math]::Round(($intervals | Measure-Object -Maximum).Maximum, 3) } else { $null }
    allWaterTemperatureValid = @($logs | Where-Object { $_.waterTempValid -ne $true }).Count -eq 0
    allWaterLevelNormal = @($logs | Where-Object { $_.waterLevel -ne 'normal' }).Count -eq 0
    allPumpsOff = @($logs | Where-Object { $_.pumpMain -or $_.pumpA -or $_.pumpB }).Count -eq 0
    latestControlValid = $latest.tdsControlValid -eq $true
    latestAgeSec = [Math]::Round($latestAgeSec, 2)
    mqttPumpCommandCountDuringObservation = $pumpCommandLines.Count
    mqttConnectionEventCountDuringObservation = $connectionEventLines.Count
    dosingRunCountBefore = [int]$startRuns.count
    dosingRunCountAfter = [int]$endRuns.count
    activeDosingRun = $null -ne $activeRun
    autoDosingEnabled = $settings.enabled
    phase22LockedOff = $settings.phase22LockedOff
    health = $health.ok
    mongoConnected = $health.mongoConnected
    mqttConnected = $health.mqttConnected
    readOnly = $true
  }

  $result.pass = $result.durationMinutes -ge $DurationMinutes `
    -and $result.measurementCount -ge (($DurationMinutes * 2) - 1) `
    -and $result.sequenceContiguous `
    -and $result.distinctBootCount -eq 1 `
    -and $result.allAccepted `
    -and $result.allWindowStable `
    -and $result.allTdsStable `
    -and $result.allControlValid `
    -and $result.allCalibrationInRange `
    -and $result.nullTdsPpmCount -eq 0 `
    -and $result.controlInvalidMeasurementCount -eq 0 `
    -and $result.intervalMaxSec -le 45 `
    -and $result.allWaterTemperatureValid `
    -and $result.allWaterLevelNormal `
    -and $result.allPumpsOff `
    -and $result.latestControlValid `
    -and $result.latestAgeSec -ge -5 `
    -and $result.latestAgeSec -le 45 `
    -and $result.mqttPumpCommandCountDuringObservation -eq 0 `
    -and $result.mqttConnectionEventCountDuringObservation -eq 0 `
    -and $result.dosingRunCountBefore -eq 0 `
    -and $result.dosingRunCountAfter -eq 0 `
    -and $result.activeDosingRun -eq $false `
    -and $result.autoDosingEnabled -eq $false `
    -and $result.phase22LockedOff -eq $true `
    -and $result.health -eq $true `
    -and $result.mongoConnected -eq $true `
    -and $result.mqttConnected -eq $true

  $result | ConvertTo-Json -Depth 4
  if (-not $result.pass) { exit 1 }
} finally {
  [void][Stage1TdsRecoveryExecutionState]::SetThreadExecutionState($esContinuous)
}
