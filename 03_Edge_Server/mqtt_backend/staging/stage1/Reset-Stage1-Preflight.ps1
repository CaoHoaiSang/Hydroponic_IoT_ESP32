$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Stage1.Common.ps1')

& (Join-Path $PSScriptRoot 'Stop-Stage1-Preflight.ps1')
$paths = Get-Stage1Paths
$stage1Root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$runtimeRoot = [IO.Path]::GetFullPath($paths.RuntimeRoot)
if (-not $runtimeRoot.StartsWith($stage1Root, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($runtimeRoot) -ne '.stage1_runtime') {
  throw "Unsafe Stage 1 reset target: $runtimeRoot"
}
if (Test-Path -LiteralPath $runtimeRoot) { Remove-Item -LiteralPath $runtimeRoot -Recurse -Force }
if (Test-Path -LiteralPath $paths.FirmwareSecrets) { Remove-Item -LiteralPath $paths.FirmwareSecrets -Force }
Write-Output 'Phase 22B Stage 1 runtime data and ignored firmware staging secret were reset.'
