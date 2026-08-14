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
.\Restart-Stage1-Backend.ps1
node .\runStage1PreflightChecks.js
.\Get-Stage1-Status.ps1
.\Stop-Stage1-Preflight.ps1
.\Reset-Stage1-Preflight.ps1
```

Run the read-only physical telemetry soak after the ESP32 USB Stage 1 profile is online:

```powershell
.\Run-Stage1-TelemetrySoak.ps1 -DurationMinutes 30
```

The soak runner prevents Windows standby for the duration of the test. It reads the Stage 1
API and broker log only; it does not publish MQTT. A passing result requires continuous
telemetry from one boot, stable/control-valid TDS windows, normal water level, all pumps OFF,
Auto Dosing OFF, the Phase 22 lock ON, zero pump-command topic lines, zero broker connection
events during the window, and healthy isolated MongoDB/MQTT connections.

After a firmware reset or profile restore, use the shorter recovery check once TDS has returned
to a control-valid state:

```powershell
.\Run-Stage1-TdsRecoveryCheck.ps1 -DurationMinutes 5
```

This check is read-only. It verifies that the active calibration continues to produce non-null,
in-range EC/TDS values from stable windows on one boot while water remains normal, all pumps
remain OFF, Auto Dosing remains OFF, no dosing run exists, and no pump-command message appears.
It fails before waiting when the initial telemetry is stale, reports an ESP32 boot transition
explicitly, and rejects MQTT disconnect/reconnect events during the observation window.

`Restart-Stage1-Backend.ps1` reloads backend source without restarting MongoDB, MQTT, or the
ESP32. It verifies the recorded process identity and reuses only the Git-ignored Stage 1
runtime credential file without printing credentials.

Firmware must be compiled with `HYDROPONIC_BUILD_PROFILE=1`. That profile uses the `stage1/`
topics, never subscribes to pump commands, rejects Serial/MQTT actuator requests, and forces all
pump GPIO outputs OFF in every loop iteration.

## Stage 2 Main Pump Profile

Stage 2 is a separate supervised profile. Prepare it only after the operator confirms the
physical checklist in `00_Docs/PHASE22B_STAGE2_MAIN_PUMP_SAFETY_PLAN.md` while 12 V is OFF.

```powershell
.\Prepare-Stage2-MainPumpRuntime.ps1 `
  -Confirmation 'CONFIRM STAGE2 PREPARE WITH 12V OFF'
```

Compile with `HYDROPONIC_BUILD_PROFILE=2`. This profile subscribes to the isolated Stage 1
command topic but accepts only bounded Main Pump pulses. It rejects continuous `set`, Pump A,
Pump B, spare, Serial actuator commands, and Main Pump pulses above 3000 ms. Pump A/B/spare
outputs are forced OFF in every loop. The backend publisher and Auto Dosing remain locked.

After upload while 12 V remains OFF, verify the runtime profile and run rejection checks:

```powershell
.\Verify-Stage2-Firmware.ps1 -Port COM5 -TimeoutSeconds 120
node .\runStage2RejectedCommandChecks.js
```

The valid physical pulse is not available until the operator explicitly confirms that the
submerged Main Pump remains OFF after 12 V is connected. Arming creates a five-minute,
single-use token; the one-shot tool consumes it before publishing one fixed 1000 ms pulse:

```powershell
.\Arm-Stage2-MainPumpPulse.ps1 `
  -Confirmation 'CONFIRM MAIN PUMP SUBMERGED AND 12V ON FOR ONE 1000MS PULSE'
node .\runStage2MainPumpPulse.js
```

Do not run those final two commands without direct supervision and an immediately reachable
physical 12 V power cut. Return to `HYDROPONIC_BUILD_PROFILE=1` after the physical test.

Immediately after the one-shot test, close the runtime command path, disconnect 12 V, compile
and upload profile 1, then verify the locked banner:

```powershell
.\Disable-Stage2-MainPumpRuntime.ps1
.\Verify-Stage1-Restore.ps1 -Port COM5 -TimeoutSeconds 120
```

## Stage 3 Pump A/B Clean-Water Profile

Stage 3 uses `HYDROPONIC_BUILD_PROFILE=3` (`USB_STAGE3_NUTRIENT_PUMPS`). It locks Main Pump,
spare, Serial actuator commands, and every continuous `set` path. Pump A/B remain pulse-only,
mutually exclusive, and capped at 1000 ms. The read-only software gate is:

```powershell
node .\checkStage3NutrientPumpReadiness.js
```

This command does not publish MQTT, write MongoDB, open ACL permissions, create an arm token, or
upload firmware. Before any later physical gate, complete
`00_Docs/PHASE22B_STAGE3_NUTRIENT_PUMP_SAFETY_PLAN.md`: keep 12V OFF, disconnect nutrient bottles,
route A/B through clean water into separate visible cups, and physically disconnect Main Pump.
