param(
  [string]$Port = 'COM5',
  [ValidateRange(10, 120)]
  [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'

$serial = [IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.ReadTimeout = 500
$lines = [Collections.Generic.List[string]]::new()
try {
  $serial.Open()
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $line = $serial.ReadLine().Trim()
      if ($line.Length -gt 0) {
        $lines.Add($line)
        Write-Output $line
      }
    } catch [TimeoutException] { }
  }
} finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
}

$text = $lines -join "`n"
$required = @(
  'Build profile: USB_STAGE1',
  'MQTT pump command subscription: DISABLED',
  'Main pump actuation: LOCKED OFF',
  'Pump A/B actuation: LOCKED OFF',
  'Serial actuator commands: DISABLED',
  'SAFETY: Continuous main pump control is disabled by build profile.',
  'MQTT pump command subscription: DISABLED BY BUILD PROFILE'
)
$missing = @($required | Where-Object { -not $text.Contains($_) })
if ($missing.Count -gt 0) {
  throw "Stage 1 restore verification failed. Missing: $($missing -join '; ')"
}
if ($text.Contains('Subscribed to stage1/hydroponic/device001/pump/cmd')) {
  throw 'Stage 1 restore unexpectedly subscribed to the pump-command topic.'
}

Write-Output 'USB Stage 1 restore verified: all actuator paths locked OFF.'
