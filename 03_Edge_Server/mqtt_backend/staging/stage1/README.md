# Phase 22B Stage 1 Preflight

This profile uses isolated MongoDB `127.0.0.1:27019`, backend `127.0.0.1:3101`, and
authenticated MQTT on `127.0.0.1:18885` plus the active private LAN IPv4 on port `18885`.
The broker never binds a wildcard address. Its firewall rule is limited to the selected local
address, `LocalSubnet`, the Mosquitto executable, and TCP port `18885`.

Runtime passwords, broker files, data, logs, and generated `SecretsStage1.h` are Git-ignored.
No account has ACL permission to write `stage1/hydroponic/device001/pump/cmd`. The backend also
runs with `PUMP_COMMANDS_DISABLED=true`; Auto Dosing remains source-locked OFF.
`stage1/hydroponic/device001/alert` is `RESERVED/UNUSED`: Stage 1 enables no firmware or
backend alert publish/subscribe path.

Set `STAGE1_WIFI_SSID` and `STAGE1_WIFI_PASSWORD` in the current PowerShell process before start
only when preparing a later physical flash. Stage 1 Preflight itself does not upload or connect
an ESP32.

```powershell
$env:STAGE1_WIFI_SSID = '<staging Wi-Fi SSID>'
$env:STAGE1_WIFI_PASSWORD = '<staging Wi-Fi password>'
.\Start-Stage1-Preflight.ps1
node .\runStage1PreflightChecks.js
.\Get-Stage1-Status.ps1
.\Stop-Stage1-Preflight.ps1
.\Reset-Stage1-Preflight.ps1
```

Firmware must be compiled with `HYDROPONIC_BUILD_PROFILE=1`. That profile uses the `stage1/`
topics, never subscribes to pump commands, rejects Serial/MQTT actuator requests, and forces all
pump GPIO outputs OFF in every loop iteration.
