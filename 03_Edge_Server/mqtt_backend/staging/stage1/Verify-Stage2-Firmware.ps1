param(
  [string]$Port = 'COM5',
  [ValidateRange(10, 120)]
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

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
  'Build profile: USB_STAGE2_MAIN_PUMP',
  'Main pump actuation: ENABLED',
  'Pump A/B actuation: LOCKED OFF',
  'Serial actuator commands: DISABLED',
  'SAFETY: Continuous main pump control is disabled by build profile.',
  'Subscribed to stage1/hydroponic/device001/pump/cmd'
)
$missing = @($required | Where-Object { -not $text.Contains($_) })
if ($missing.Count -gt 0) {
  throw "Stage 2 firmware verification failed. Missing: $($missing -join '; ')"
}

$paths = Get-Stage1Paths
[ordered]@{
  profile = 'USB_STAGE2_MAIN_PUMP'
  port = $Port
  verifiedAtUtc = [DateTime]::UtcNow.ToString('o')
  expiresAtUtc = [DateTime]::UtcNow.AddMinutes(30).ToString('o')
  pumpMainPulseOnly = $true
  maxDurationMs = 3000
  nutrientPumpsLocked = $true
  serialActuatorsDisabled = $true
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $paths.Secrets 'stage2-firmware-verified.json') -Encoding UTF8

Write-Output 'Stage 2 firmware profile verified. Physical gate remains closed.'
