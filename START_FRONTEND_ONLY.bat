@echo off
setlocal
cd /d "%~dp0\03_Edge_Server\frontend"
where node >nul 2>nul || (echo [ERROR] Can cai Node.js 20 tro len: https://nodejs.org/ & pause & exit /b 1)
if not exist node_modules call npm ci
echo.
echo HydroFlow dang chay tai http://localhost:5173
echo Che do nay van chay khi chua co MongoDB/MQTT; actuator luon bi khoa.
start "" http://localhost:5173
call npm run dev
