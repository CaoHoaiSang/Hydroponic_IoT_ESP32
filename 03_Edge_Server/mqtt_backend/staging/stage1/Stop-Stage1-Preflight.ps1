$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

$paths = Get-Stage1Paths
if (-not (Test-Path -LiteralPath $paths.StateFile)) {
  Get-NetFirewallRule -DisplayName $Stage1FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  Write-Output 'Phase 22B Stage 1 preflight is not recorded as running.'
  exit 0
}

$state = Get-Content -LiteralPath $paths.StateFile -Raw | ConvertFrom-Json
$errors = @()
$reverse = @($state.Processes); [array]::Reverse($reverse)
foreach ($item in $reverse) {
  $process = Get-Process -Id $item.Pid -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  $expectedStart = [DateTime]::Parse($item.StartedAtUtc).ToUniversalTime()
  if ($process.Path -ne $item.Path -or [Math]::Abs(($process.StartTime.ToUniversalTime() - $expectedStart).TotalSeconds) -gt 1) {
    $errors += "Refused to stop PID $($item.Pid): identity mismatch for $($item.Name)"
    continue
  }
  Stop-Process -Id $item.Pid -Force
  $process.WaitForExit(10000) | Out-Null
}
Get-NetFirewallRule -DisplayName $Stage1FirewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule

$state | Add-Member -NotePropertyName StoppedAtUtc -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force
$state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $paths.StateFile -Encoding UTF8
if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; exit 1 }
Write-Output 'Phase 22B Stage 1 preflight stopped and its scoped firewall rule was removed.'
