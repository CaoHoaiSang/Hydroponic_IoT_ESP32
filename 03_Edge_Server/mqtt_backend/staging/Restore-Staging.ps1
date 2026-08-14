param(
  [Parameter(Mandatory)][string]$InputPath,
  [Parameter(Mandatory)][ValidateSet('RESTORE_EMPTY_STAGE0')][string]$Confirm
)

$ErrorActionPreference = 'Stop'
$backendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$resolvedInput = [IO.Path]::GetFullPath($InputPath)
if (-not (Test-Path -LiteralPath $resolvedInput -PathType Leaf)) { throw "Backup file not found: $resolvedInput" }

Push-Location $backendRoot
try {
  & node.exe 'staging/stage0Backup.js' 'restore' '--input' $resolvedInput '--confirm' $Confirm
  if ($LASTEXITCODE -ne 0) { throw "Stage 0 restore failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
