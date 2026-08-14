@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_FULL_LOCAL.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] HydroFlow khong khoi dong duoc. Doc thong bao o tren.
  echo Huong dan: README_HYDROFLOW_LOCAL.md
  pause
)
exit /b %EXIT_CODE%
