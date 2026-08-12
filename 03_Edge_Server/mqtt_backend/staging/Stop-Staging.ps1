$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage0.Common.ps1')

$paths = Get-Stage0Paths
if (-not (Test-Path -LiteralPath $paths.StateFile)) {
  Write-Output 'Phase 22B Stage 0 is not recorded as running.'
  exit 0
}

$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$errors = @()
$reverseProcesses = @($state.Processes)
[array]::Reverse($reverseProcesses)
foreach ($item in $reverseProcesses) {
  $process = Get-Process -Id $item.Pid -ErrorAction SilentlyContinue
  if (-not $process) {
    continue
  }
  $actualPath = $process.Path
  $actualStart = $process.StartTime.ToUniversalTime()
  $expectedStart = [DateTime]::Parse($item.StartedAtUtc).ToUniversalTime()
  if ($actualPath -ne $item.Path -or [Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 1) {
    $errors += "Refused to stop PID $($item.Pid): process identity no longer matches $($item.Name)"
    continue
  }
  Stop-Process -Id $item.Pid -Force
  $process.WaitForExit(10000) | Out-Null
}

$state | Add-Member -NotePropertyName StoppedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Output 'Phase 22B Stage 0 stopped.'
