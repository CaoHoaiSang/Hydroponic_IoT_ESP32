$ErrorActionPreference = 'Stop'

$backendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $backendRoot
try {
  & node.exe 'staging/stage0Backup.js' 'backup'
  if ($LASTEXITCODE -ne 0) { throw "Stage 0 backup failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}
