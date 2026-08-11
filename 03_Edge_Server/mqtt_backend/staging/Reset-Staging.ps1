$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage0.Common.ps1')

& (Join-Path $PSScriptRoot 'Stop-Staging.ps1')

$paths = Get-Stage0Paths
$stagingRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$runtimeRoot = [IO.Path]::GetFullPath($paths.RuntimeRoot)
if (-not $runtimeRoot.StartsWith($stagingRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unsafe Stage 0 reset target: $runtimeRoot"
}
if ([IO.Path]::GetFileName($runtimeRoot) -ne '.stage0_runtime') {
  throw "Unexpected Stage 0 reset directory: $runtimeRoot"
}

if (Test-Path -LiteralPath $runtimeRoot) {
  Remove-Item -LiteralPath $runtimeRoot -Recurse -Force
}
Write-Output "Phase 22B Stage 0 data reset: $runtimeRoot"
