param(
  [ValidateRange(1, 240)]
  [int]$DurationMinutes = 30,
  [string]$DeviceId = 'device001'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Stage1ExecutionState {
  [DllImport("kernel32.dll")]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@

$esContinuous = [uint32]::Parse('80000000', [Globalization.NumberStyles]::HexNumber)
$esSystemRequired = [uint32]0x00000001
$keepAwakeResult = [Stage1ExecutionState]::SetThreadExecutionState($esContinuous -bor $esSystemRequired)
if ($keepAwakeResult -eq 0) { throw 'Failed to prevent Windows standby for the soak test.' }

$apiRoot = "http://127.0.0.1:$Stage1HttpPort"
$paths = Get-Stage1Paths
$brokerLog = Join-Path $paths.Logs 'mosquitto.stderr.log'
$startedAtUtc = [DateTime]::UtcNow
$startedLatest = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/latest").latest
$startSequence = [int]$startedLatest.measurementSeq
$startBootId = [string]$startedLatest.bootId
$brokerStartLineCount = if (Test-Path -LiteralPath $brokerLog) {
  @(Get-Content -LiteralPath $brokerLog).Count
} else { 0 }

try {
  Start-Sleep -Seconds ($DurationMinutes * 60)

  $endedAtUtc = [DateTime]::UtcNow
  $health = Invoke-RestMethod "$apiRoot/health"
  $settings = (Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/auto-dosing/settings").data
  $logs = @((Invoke-RestMethod "$apiRoot/api/devices/$DeviceId/sensor-logs?limit=100").data |
    Where-Object {
      $_.bootId -eq $startBootId -and
      $_.measurementSeq -gt $startSequence -and
      [DateTime]$_.receivedAt -ge $startedAtUtc
    } | Sort-Object measurementSeq)
  if ($logs.Count -eq 0) { throw 'No telemetry was received during the soak test.' }

  $intervals = @()
  for ($index = 1; $index -lt $logs.Count; $index++) {
    $intervals += ([DateTime]$logs[$index].receivedAt - [DateTime]$logs[$index - 1].receivedAt).TotalSeconds
  }
  $expectedCount = $logs[-1].measurementSeq - $logs[0].measurementSeq + 1
  $fullSpreads = @($logs | ForEach-Object { [double]$_.tdsSpreadRaw })
  $robustSpreads = @($logs | ForEach-Object { [double]$_.tdsRobustSpreadRaw })
  $ppmValues = @($logs | ForEach-Object { [double]$_.tdsPpm })
  $averagePpm = ($ppmValues | Measure-Object -Average).Average
  $ppmVariance = (($ppmValues | ForEach-Object {
    [Math]::Pow($_ - $averagePpm, 2)
  } | Measure-Object -Average).Average)
  $newBrokerLines = if (Test-Path -LiteralPath $brokerLog) {
    @(Get-Content -LiteralPath $brokerLog | Select-Object -Skip $brokerStartLineCount)
  } else { @() }
  $pumpCommandLines = @($newBrokerLines | Select-String 'stage1/hydroponic/device001/pump/cmd')
  $connectionEventLines = @($newBrokerLines | Select-String 'New connection|New client connected|disconnected|timed out|Socket error')

  $result = [ordered]@{
    startedAtUtc = $startedAtUtc.ToString('o')
    endedAtUtc = $endedAtUtc.ToString('o')
    durationMinutes = [Math]::Round(($endedAtUtc - $startedAtUtc).TotalMinutes, 2)
    startSequence = $startSequence
    firstSequence = $logs[0].measurementSeq
    lastSequence = $logs[-1].measurementSeq
    measurementCount = $logs.Count
    sequenceContiguous = $expectedCount -eq $logs.Count
    distinctBootCount = @($logs.bootId | Sort-Object -Unique).Count
    allAccepted = @($logs | Where-Object { $_.telemetryOrderStatus -ne 'ACCEPTED' }).Count -eq 0
    allWindowStable = @($logs | Where-Object { $_.tdsWindowStable -ne $true }).Count -eq 0
    allTdsStable = @($logs | Where-Object { $_.tdsStable -ne $true }).Count -eq 0
    allControlValid = @($logs | Where-Object { $_.tdsControlValid -ne $true }).Count -eq 0
    fullSpreadMin = ($fullSpreads | Measure-Object -Minimum).Minimum
    fullSpreadAverage = [Math]::Round(($fullSpreads | Measure-Object -Average).Average, 2)
    fullSpreadMax = ($fullSpreads | Measure-Object -Maximum).Maximum
    robustSpreadMin = ($robustSpreads | Measure-Object -Minimum).Minimum
    robustSpreadAverage = [Math]::Round(($robustSpreads | Measure-Object -Average).Average, 2)
    robustSpreadMax = ($robustSpreads | Measure-Object -Maximum).Maximum
    ppmMin = ($ppmValues | Measure-Object -Minimum).Minimum
    ppmAverage = [Math]::Round($averagePpm, 2)
    ppmMax = ($ppmValues | Measure-Object -Maximum).Maximum
    ppmStdDev = [Math]::Round([Math]::Sqrt($ppmVariance), 2)
    intervalAverageSec = if ($intervals.Count) { [Math]::Round(($intervals | Measure-Object -Average).Average, 2) } else { $null }
    intervalMaxSec = if ($intervals.Count) { [Math]::Round(($intervals | Measure-Object -Maximum).Maximum, 3) } else { $null }
    allWaterLevelNormal = @($logs | Where-Object { $_.waterLevel -ne 'normal' }).Count -eq 0
    allPumpsOff = @($logs | Where-Object { $_.pumpMain -or $_.pumpA -or $_.pumpB }).Count -eq 0
    mqttPumpCommandCount = $pumpCommandLines.Count
    mqttConnectionEventCount = $connectionEventLines.Count
    autoDosingEnabled = $settings.enabled
    phase22LockedOff = $settings.phase22LockedOff
    health = $health.ok
    mongoConnected = $health.mongoConnected
    mqttConnected = $health.mqttConnected
  }
  $result.pass = $result.durationMinutes -ge $DurationMinutes `
    -and $result.measurementCount -ge (($DurationMinutes * 2) - 1) `
    -and $result.sequenceContiguous `
    -and $result.distinctBootCount -eq 1 `
    -and $result.allAccepted `
    -and $result.allWindowStable `
    -and $result.allTdsStable `
    -and $result.allControlValid `
    -and $result.intervalMaxSec -le 45 `
    -and $result.allWaterLevelNormal `
    -and $result.allPumpsOff `
    -and $result.mqttPumpCommandCount -eq 0 `
    -and $result.mqttConnectionEventCount -eq 0 `
    -and $result.autoDosingEnabled -eq $false `
    -and $result.phase22LockedOff -eq $true `
    -and $result.health -eq $true `
    -and $result.mongoConnected -eq $true `
    -and $result.mqttConnected -eq $true

  $result | ConvertTo-Json -Depth 4
  if (-not $result.pass) { exit 1 }
} finally {
  [void][Stage1ExecutionState]::SetThreadExecutionState($esContinuous)
}
