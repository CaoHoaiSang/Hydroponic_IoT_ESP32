# CODEX PHASE 22B STAGE 0 REPORT

## 1. Conclusion

`READY_FOR_USB_STAGE1`

The isolated Stage 0 stack was started and tested against real local MongoDB and
Mosquitto instances. The lifecycle was also verified through a complete
`stop -> reset -> start -> test` cycle. Auto Dosing remained OFF, manual and publisher
pump paths were blocked, and the test observed zero pump commands and zero dosing runs.

## 2. Stage 0 Isolation Contract

| Component | Actual Stage 0 value |
|---|---|
| MongoDB | `mongodb://127.0.0.1:27018` |
| Database | `hydroponic_stage0` |
| MQTT broker | `mqtt://127.0.0.1:18884` |
| Backend API | `http://127.0.0.1:3100` |
| Dashboard | `http://127.0.0.1:3100/` |
| Sensor topic | `stage0/hydroponic/device001/sensor` |
| Pump command topic | `stage0/hydroponic/device001/pump/cmd` |
| Pump status topic | `stage0/hydroponic/device001/pump/status` |
| Alert topic | `stage0/hydroponic/device001/alert` |
| Shadow Mode | Enabled for observation |
| Auto Dosing | Hard-locked OFF |
| Manual/publisher pump commands | Disabled by `PUMP_COMMANDS_DISABLED=true` |

MongoDB, MQTT, and HTTP bind only to `127.0.0.1`. The scripts refuse to start when a
Stage 0 port is already occupied rather than reusing an unknown service.

## 3. Start, Status, Stop And Reset

Run from `03_Edge_Server/mqtt_backend`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\staging\Start-Staging.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\staging\Get-StagingStatus.ps1
npm run stage0:test
powershell -NoProfile -ExecutionPolicy Bypass -File .\staging\Stop-Staging.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\staging\Reset-Staging.ps1
```

`Start-Staging.ps1` launches hidden user processes for the isolated MongoDB, Mosquitto,
and backend, waits for all ports, then requires `/health` to report both MongoDB and MQTT
connected. It passes environment variables directly to the backend process and does not
load a production credential.

`Stop-Staging.ps1` stops only a process whose PID, executable path, and start time match
the recorded Stage 0 state. `Reset-Staging.ps1` validates the resolved target and deletes
only `staging/.stage0_runtime`. Generated data and logs are Git-ignored.

Current handoff state: Stage 0 is running and healthy at the endpoints above.

## 4. Runtime Verification

### Actual end-to-end command

```text
npm run stage0:test
```

Result from the isolated real services:

```json
{
  "result": "PASS",
  "mongoUri": "mongodb://127.0.0.1:27018",
  "database": "hydroponic_stage0",
  "mqttUrl": "mqtt://127.0.0.1:18884",
  "httpUrl": "http://127.0.0.1:3100",
  "sensorTopic": "stage0/hydroponic/device001/sensor",
  "pumpCommandTopic": "stage0/hydroponic/device001/pump/cmd",
  "sensorLogs": 9,
  "shadowDecisions": 7,
  "stableDistinctMeasurements": 3,
  "delayedMeasurementReason": "tds_measurement_stale",
  "currentBootId": "stageboot0002",
  "autoDosingEnabled": false,
  "pumpCommandsObserved": 0,
  "dosingRuns": 0,
  "pumpLogs": 0,
  "dashboardStatus": 200,
  "dashboardAssetsStatus": [200, 200]
}
```

The same check passed again after stopping, resetting, and restarting the stack.

### Verified behavior

| Requirement | Result |
|---|---|
| Telemetry Identity V2 | PASS |
| First boot and increasing sequence | PASS |
| Two-packet boot transition | PASS |
| Previous boot retired | PASS |
| Duplicate/retry idempotency | PASS, one sensor log and one Shadow decision per identity |
| Out-of-order telemetry | PASS, audit-only and did not replace latest |
| Delayed telemetry | PASS, control-invalid with `tds_measurement_stale` |
| Delayed data contribution to stability | Zero |
| Three distinct measurements | PASS, `tdsStable=true` after three verified measurements |
| Shadow decision/history | PASS, 7 records and read-only API response |
| Latest/sensor log APIs | PASS |
| Dashboard | HTML, production `app.js`, and `styles.css` all HTTP 200 |
| Auto Dosing enable attempt | HTTP 409, `phase22a_auto_dosing_locked_off` |
| Pulse pump API attempt | HTTP 400, `pump_commands_disabled` |
| Main pump ON API attempt | HTTP 400, `pump_commands_disabled` |
| MQTT pump command observed | 0 |
| Pump logs created | 0 |
| Dosing runs created | 0 |

The delayed case is produced by backdating only a staging fixture anchor before sending
the next real MQTT payload. This exercises the production MQTT/backend/MongoDB path without
waiting three minutes and does not touch operational data.

## 5. Regression And Syntax Results

### Full regression

```text
Command: npm test
Tests: 175
Pass: 175
Fail: 0
Skipped: 0
Exit code: 0
Duration: 1124.0729 ms
```

The native firmware host harness remained part of this run and passed with
`g++ -std=c++17 -Wall -Wextra -Werror`.

### Syntax and script parsing

```text
JavaScript files checked with node --check: 45
JavaScript failures: 0
PowerShell staging scripts parsed: 5
PowerShell parse errors: 0
Exit code: 0
```

Firmware source was not modified in Stage 0, so the full Arduino compile was not repeated.
The current firmware evidence remains the Phase 22A Fix 2 compile: flash 943700 bytes
(71%), static RAM 47208 bytes (14%), exit code 0. No firmware was uploaded.

## 6. Production Isolation Evidence

- Existing default listeners remained separate: MongoDB `127.0.0.1:27017` and MQTT
  `0.0.0.0:1883` had different pre-existing process IDs.
- The Stage 0 backend process had established connections only to
  `127.0.0.1:27018` and `127.0.0.1:18884`.
- The final backend listener was verified as `127.0.0.1:3100`, not `::` or `0.0.0.0`.
- Stage topics all start with `stage0/`; operational topic names were not published.
- The fixed database name is `hydroponic_stage0`, not `hydroponic_iot`.
- `.env.staging.example` contains no username, password, token, URI credential, or secret.
- No production `.env` or `Secrets.h` was read or created.
- No migration, calibration activation/retirement, firmware upload, ESP32 connection, or
  physical hardware operation occurred.

## 7. Pump And Auto Dosing Safety Evidence

Stage 0 uses two pump-command barriers:

1. `pumpCommandService.js` returns `pump_commands_disabled` before validation or device
   state access for both pulse and main-pump commands.
2. `mqttClient.js` rejects publisher calls with code `PUMP_COMMANDS_DISABLED`.

The runtime MQTT subscriber observed zero messages on the isolated pump command topic.
The backend log contained zero `Pump command published` records. MongoDB contained zero
`pump_logs` and zero `dosing_runs`. The settings document remained `enabled:false`, and an
API attempt to enable Auto Dosing was rejected by the existing Phase 22 lock.

## 8. Files Created

- `03_Edge_Server/mqtt_backend/staging/.env.staging.example`: secret-free fixed staging values.
- `03_Edge_Server/mqtt_backend/staging/mosquitto.stage0.conf`: loopback-only broker config.
- `03_Edge_Server/mqtt_backend/staging/Stage0.Common.ps1`: shared paths, ports, discovery, and wait helpers.
- `03_Edge_Server/mqtt_backend/staging/Start-Staging.ps1`: isolated process startup and health checks.
- `03_Edge_Server/mqtt_backend/staging/Stop-Staging.ps1`: identity-checked process shutdown.
- `03_Edge_Server/mqtt_backend/staging/Reset-Staging.ps1`: bounded runtime-data reset.
- `03_Edge_Server/mqtt_backend/staging/Get-StagingStatus.ps1`: JSON health/status output.
- `03_Edge_Server/mqtt_backend/staging/runStage0Checks.js`: real MongoDB/MQTT/API/Dashboard test.
- `03_Edge_Server/mqtt_backend/staging/README.md`: staging operation guide.
- `03_Edge_Server/mqtt_backend/test/stage0Safety.test.js`: pump lock regression tests.
- `CODEX_PHASE22B_STAGE0_REPORT.md`: this report.

## 9. Files Modified

- `.gitignore`: ignores `**/.stage0_runtime/`.
- `README.md`: current Phase 22B Stage 0 status and corrected Fix 2 compile result.
- `00_Docs/Telemetry_Identity_Shadow_Mode.md`: corrected Fix 2/runtime status and staging evidence.
- `00_Docs/PROJECT_STATUS_REPORT.md`: Stage 0 state, files, evidence, risks, and next task.
- `03_Edge_Server/mqtt_backend/package.json`: adds `stage0:test`.
- `03_Edge_Server/mqtt_backend/src/httpServer.js`: optional `HTTP_HOST` bind for loopback staging.
- `03_Edge_Server/mqtt_backend/src/mqttClient.js`: publisher-level environment pump lock.
- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js`: service-level manual pump lock.

No firmware file, GPIO definition, sensor behavior, calibration algorithm, dosing algorithm,
database schema, or Dashboard production JavaScript was modified.

## 10. Dependency Audit Impact

No dependency was upgraded automatically.

`npm audit` result:

| Package | Severity | Dependency path | Stage 0 exposure |
|---|---|---|---|
| `body-parser@1.20.5` | Low | `express@4.22.2 -> body-parser` | Advisory requires an invalid configured limit; this app uses `express.json()` without a custom limit |
| `ip-address@10.2.0` | High | `mongodb@6.21.0 -> socks@2.8.9 -> ip-address` | Stage 0 uses a fixed loopback Mongo URI and no SOCKS proxy or user-controlled address |

These conditions reduce direct Stage 0 exploitability but do not remove the advisories.
Before production, perform a dedicated lockfile update, inspect dependency changelogs,
rerun all tests and staging checks, and verify proxy/URI handling. Do not use `npm audit fix`
blindly on the operational branch.

## 11. Remaining Risks And Stage 1 Boundary

- Stage 0 Mosquitto is anonymous by design but loopback-only; this config must never be
  exposed or reused as production configuration.
- Real ESP32 USB/upload and physical telemetry have not been tested in Stage 0.
- No pump power, nutrient bottle, or other actuator should be connected in USB Stage 1.
- The two npm advisories remain open pending a dedicated dependency task.
- Long-duration process recovery and machine reboot recovery were not tested.

USB Stage 1 may proceed only with Auto Dosing OFF, pump power removed, nutrient bottles
disconnected, and the ESP32 pointed exclusively at the isolated Stage 0 broker/topic.

Final conclusion: `READY_FOR_USB_STAGE1`.
