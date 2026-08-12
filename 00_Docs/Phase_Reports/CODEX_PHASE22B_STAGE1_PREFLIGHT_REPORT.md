# CODEX PHASE 22B STAGE 1 PREFLIGHT REPORT

## 1. Conclusion

**PARTIAL**

The isolated Stage 1 MongoDB, authenticated MQTT broker, backend, Shadow Mode, API, and
Dashboard started and passed real runtime checks. Firmware/backend topics match, all actuator
locks passed source/native tests, and the complete USB Stage 1 firmware profile compiled.

`READY_FOR_PHYSICAL_USB_STAGE1` is intentionally not claimed because staging Wi-Fi SSID and
password were not available (`FirmwareWifiConfigured=false`). The LAN MQTT test used the
machine's private IPv4 from a client on the same machine; no ESP32 or second physical Wi-Fi
peer was connected. Firmware was not uploaded.

## 2. Implemented Scope

| Requirement | Status | Result |
|---|---|---|
| Loopback plus exact private LAN bind | Complete | MQTT listens only on `127.0.0.1:18885` and `192.168.1.90:18885`. |
| No wildcard bind | Complete | No `0.0.0.0` or `::` listener; runtime listener count on forbidden addresses was zero. |
| Broker authentication and ACL | Complete | Anonymous connection rejected; unauthorized pump-command publishes denied. |
| Runtime-only credentials | Complete | Generated under ignored `.stage1_runtime/secrets/`; generated firmware secret is ignored. |
| Firmware staging profile and topic parity | Complete | Compile profile `HYDROPONIC_BUILD_PROFILE=1` uses `stage1/` topics and port `18885`. |
| Firmware actuator lock | Complete | No MQTT command subscription; MQTT/Serial/local ON paths blocked; all outputs forced OFF. |
| Preserve backend publisher/service locks | Complete | `PUMP_COMMANDS_DISABLED=true`; both existing source checks retained. |
| Real isolated staging checks | Complete | MongoDB, MQTT, backend, Shadow, API, Dashboard and lifecycle checks passed. |
| Zero pump command / zero dosing run | Complete | Zero delivered command, zero `dosing_runs`, zero `pump_logs`; Auto Dosing false. |
| Full staging-profile firmware compile | Complete | Exit 0; flash/RAM reported below. |
| Physical ESP32 Wi-Fi route | Unverified | Wi-Fi secret not configured; no upload, USB connection, or hardware test. |

## 3. Runtime Topology

| Component | Actual endpoint | Exposure |
|---|---|---|
| MongoDB | `mongodb://127.0.0.1:27019/hydroponic_stage1_preflight` | Loopback only |
| MQTT | `mqtt://127.0.0.1:18885` | Loopback authenticated listener |
| MQTT LAN | `mqtt://192.168.1.90:18885` | Exact private IPv4, authenticated, ACL protected |
| Backend/Dashboard | `http://127.0.0.1:3101` | Loopback only |

The scoped Windows Firewall rule permits only Mosquitto TCP port `18885`, local address
`192.168.1.90`, and `LocalSubnet`. The stop/reset scripts remove this rule.

Actual firmware/backend topics:

- Sensor: `stage1/hydroponic/device001/sensor`
- Pump command identifier: `stage1/hydroponic/device001/pump/cmd`
- Pump status: `stage1/hydroponic/device001/pump/status`
- Alert: `stage1/hydroponic/device001/alert`

The command topic exists as a parity identifier, but the firmware profile does not subscribe
to it and no Stage 1 ACL account can write it.

## 4. Start, Stop, Status, Reset

```powershell
cd 03_Edge_Server\mqtt_backend\staging\stage1
.\Start-Stage1-Preflight.ps1
node .\runStage1PreflightChecks.js
.\Get-Stage1-Status.ps1
.\Stop-Stage1-Preflight.ps1
.\Reset-Stage1-Preflight.ps1
```

For a later physical flash, set `STAGE1_WIFI_SSID` and `STAGE1_WIFI_PASSWORD` only in the
current process before start. Values must never be committed or copied into a report.

Stop/reset/start was executed successfully. Reset removed runtime data and the generated
firmware secret; restart regenerated isolated credentials/configuration and the complete
Stage 1 integration test passed again. The final staging stack was left running for inspection.

## 5. Authentication And ACL Evidence

Runtime checks through `mqtt://192.168.1.90:18885` established:

- Anonymous connection: rejected (`not authorised`).
- Authenticated backend/device/auditor connections: accepted.
- Device and backend attempts to publish Pump A command: broker logged two `Denied PUBLISH` events.
- Messages delivered on pump-command topic: `0`.
- Generated ACL contains no `topic write stage1/hydroponic/device001/pump/cmd` grant.
- Broker listener config has `allow_anonymous false`.

Mosquitto 2.1 may acknowledge a subscription filter and enforce read ACL at delivery time;
therefore the executable assertion is zero command delivery, not SUBACK value alone.

## 6. Actuator Lock Evidence

Four independent controls are present:

1. Build profile sets `ACTUATORS_LOCKED=true` and `MQTT_PUMP_COMMANDS_ENABLED=false`.
2. MQTT subscribe is conditional and disabled in USB Stage 1.
3. MQTT and Serial actuator handlers reject commands while the lock is active.
4. `Pumps.cpp` converts every ON request to OFF and rewrites Main/A/B/spare OFF each loop.

The native C++ harness compiled and executed with `HYDROPONIC_BUILD_PROFILE=1`; all compile-time
and runtime assertions passed. The Arduino full-profile build also passed. No output pin was
physically measured because no ESP32 or hardware was connected.

Important source references:

- `02_ESP32_Main_Firmware/Hydroponic_Device001/BuildProfile.h:11`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h:44`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/MqttService.cpp:82`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Pumps.cpp:31`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Pumps.cpp:69`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino:525`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino:633`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino:775`
- `03_Edge_Server/mqtt_backend/src/mqttClient.js:101`
- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js:73`

## 7. Tests And Build

### Full regression

Command:

```powershell
cd 03_Edge_Server\mqtt_backend
npm test
```

Result: `180` passed, `0` failed, `0` skipped, exit code `0`.

### JavaScript syntax

Command pattern:

```powershell
Get-ChildItem -Recurse -File -Filter *.js | ... | ForEach-Object { node --check $_.FullName }
```

Result: `47` files checked, `0` failures, exit code `0`.

### Real Stage 1 integration

Command:

```powershell
npm run stage1:test
```

Result after lifecycle reset: PASS, exit code `0`.

- Sensor logs: `9`
- Shadow decisions: `7`
- Stability distinct measurements: `3`
- Duplicate/retry idempotency: PASS
- Out-of-order and delayed retry: PASS
- Boot transition: PASS
- Dashboard/API HTTP status: `200`
- Auto Dosing enabled: `false`
- Pump commands observed/delivered: `0`
- Dosing runs: `0`
- Pump logs: `0`
- Production endpoints accessed: `0`

### PowerShell and lifecycle

All five Stage 1 PowerShell files parsed without errors. Start, status, stop, reset, restart,
and post-reset integration test passed. Active listeners after restart were exactly:

```text
127.0.0.1:27019
127.0.0.1:3101
127.0.0.1:18885
192.168.1.90:18885
```

### Full firmware compile

Command:

```powershell
arduino-cli compile `
  --fqbn "esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default" `
  --build-path D:\Hydroponic_PHASE22B_STAGE1_BUILD_20260810 `
  --build-property "compiler.cpp.extra_flags=-DHYDROPONIC_BUILD_PROFILE=1" `
  02_ESP32_Main_Firmware\Hydroponic_Device001
```

Toolchain: Arduino CLI `1.5.1`, ESP32 core `3.3.10`.

Result: exit code `0`.

- Flash: `938548 / 1310720` bytes (`71%`)
- Static RAM: `47208 / 327680` bytes (`14%`)
- Remaining dynamic memory: `280472` bytes

The ignored firmware staging secret used generated broker credentials and placeholder Wi-Fi
values because staging Wi-Fi credentials were not supplied. Compile success is not a physical
network test. No upload command was run.

## 8. Files Created Or Modified

| File | Change and purpose |
|---|---|
| `.gitignore` | Ignores Stage 1 runtime and firmware secret. |
| `README.md` | Documents Stage 1 topology, compile result, and lifecycle. |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Records Stage 1 partial status and physical blocker. |
| `00_Docs/Telemetry_Identity_Shadow_Mode.md` | Adds Stage 1 runtime/compile status. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/BuildProfile.h` | Defines operational and USB Stage 1 profiles. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/ActuatorSafety.h` | Pure fail-closed actuator state helper. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h` | Selects isolated topics/client ID by profile. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/SecretsStage1.h.example` | Secret-free profile template. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/MqttService.cpp` | Selects Stage 1 secret and disables command subscription. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Pumps.h` | Exposes lock enforcement function. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Pumps.cpp` | Forces all ON requests and outputs OFF in Stage 1. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino` | Rejects MQTT/Serial/local actuation and maintains OFF. |
| `03_Edge_Server/mqtt_backend/package.json` | Adds `stage1:test` command. |
| `03_Edge_Server/mqtt_backend/staging/runStage0Checks.js` | Makes the proven integration harness configurable while preserving Stage 0 defaults. |
| `03_Edge_Server/mqtt_backend/staging/stage1/.env.stage1.example` | Secret-free backend staging variables. |
| `03_Edge_Server/mqtt_backend/staging/stage1/mosquitto.stage1.conf.example` | Authenticated dual-address broker template. |
| `03_Edge_Server/mqtt_backend/staging/stage1/Stage1.Common.ps1` | Paths, LAN discovery, ports, binaries, and secret helpers. |
| `03_Edge_Server/mqtt_backend/staging/stage1/Start-Stage1-Preflight.ps1` | Generates credentials/ACL/config, scoped firewall, secret, and starts services. |
| `03_Edge_Server/mqtt_backend/staging/stage1/Stop-Stage1-Preflight.ps1` | Identity-safe process stop and firewall cleanup. |
| `03_Edge_Server/mqtt_backend/staging/stage1/Reset-Stage1-Preflight.ps1` | Checked runtime and generated-secret reset. |
| `03_Edge_Server/mqtt_backend/staging/stage1/Get-Stage1-Status.ps1` | Reports loopback/LAN health without credentials. |
| `03_Edge_Server/mqtt_backend/staging/stage1/runStage1PreflightChecks.js` | Real auth/ACL, telemetry, Shadow, API/Dashboard, and zero-side-effect checks. |
| `03_Edge_Server/mqtt_backend/staging/stage1/README.md` | Stage 1 operator instructions and safety contract. |
| `03_Edge_Server/mqtt_backend/test/fixtures/stage1_actuator_lock_host_test.cpp` | Native profile lock assertions. |
| `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js` | Topic, broker, firmware lock, and backend lock regression tests. |
| `CODEX_PHASE22B_STAGE1_PREFLIGHT_REPORT.md` | This consolidated handoff report. |
| `CODEX_PHASE22B_STAGE1_PREFLIGHT.patch` | Secret-safe source patch generated from the pre-Stage-1 baseline. |

## 9. Production Isolation And Mandatory Safety Confirmations

- No production database was contacted. Port `27017` was explicitly excluded; staging used `27019`.
- No production broker was contacted. Port `1883` was explicitly excluded; staging used `18885`.
- No production credential was read, copied, logged, or placed in this report.
- No MQTT pump command was successfully published or delivered.
- Auto Dosing remained OFF and enable attempts were rejected.
- No dosing run or pump log was created.
- No calibration set was activated or retired.
- No firmware upload was attempted.
- No ESP32, pump, sensor, nutrient bottle, or other hardware was connected or operated.
- No ZIP was created.

## 10. Remaining Risks And Next Step

1. Configure a dedicated staging Wi-Fi SSID/password in process-only environment variables,
   restart Stage 1, and verify `FirmwareWifiConfigured=true` without exposing values.
2. On a supervised physical USB session, compile the same profile, upload it, and confirm its
   startup reports `USB_STAGE1`, command subscription `DISABLED`, and actuator lock `ON`.
3. With pumps physically disconnected, verify ESP32 telemetry reaches the LAN broker and the
   Dashboard while all Main/A/B GPIO outputs remain electrically OFF.
4. Repeat unauthorized MQTT and Serial command attempts while measuring outputs. Only after
   this physical evidence may the status advance beyond `PARTIAL`.

## 11. Secret Review

The tracked source, this report, and the patch contain no runtime password, Wi-Fi password,
token, MongoDB credential, or production endpoint. Runtime credentials remain only in ignored
files. The patch excludes `.stage1_runtime/`, `Secrets.h`, and `SecretsStage1.h`.
