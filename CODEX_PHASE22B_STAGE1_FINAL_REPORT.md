# CODEX PHASE 22B STAGE 1 FINAL REPORT

> Historical Stage 1 handoff. Its Next Work section was completed or superseded by later
> Phase 22B calibration, telemetry soak, Main Pump, TDS maintenance, and closure work.

## 1. Scope And Result

Conclusion: `READY_FOR_PHYSICAL_USB_STAGE1` (physical read-only telemetry PASS).

The isolated Stage 1 stack was started, the `USB_STAGE1` firmware profile was compiled and
uploaded to the ESP32 on `COM5`, and real telemetry was received through Wi-Fi, authenticated
MQTT, the backend, MongoDB staging, API, and Dashboard. Pump power and nutrient lines were
physically disconnected by the user. No actuator command was issued.

## 2. Requirement Status

| Requirement | Status | Evidence |
|---|---|---|
| Exact LAN staging route | Complete | MQTT `172.20.10.2:18885`; ESP32 received `172.20.10.12`. |
| Authenticated MQTT and ACL | Complete | Stage 1 integration PASS; anonymous rejected and device command delivery denied. |
| Firmware topic parity | Complete | Sensor `stage1/hydroponic/device001/sensor`; status `stage1/hydroponic/device001/pump/status`. |
| Firmware actuator lock | Complete | Serial: `USB_STAGE1`, command subscription disabled, actuator lock ON. |
| Physical upload | Complete | ESP32-D0WD-V3 on COM5; all written hashes verified; exit code 0. |
| Real telemetry path | Complete | Four initial physical sensor logs persisted; later API measurement sequence reached 5. |
| Zero side effects | Complete | Pump command 0, dosing run 0, pump log 0, Auto Dosing false. |
| Sensor/control validity | Partially verified | Telemetry works; current water level is low and no active calibration was introduced. |

## 3. Files Modified Or Created

- `03_Edge_Server/mqtt_backend/staging/runStage0Checks.js`: supports current HydroFlow SPA
  identity and checks Auto Dosing text across the HTML shell and loaded app source.
- `03_Edge_Server/mqtt_backend/staging/stage1/Start-Stage1-Preflight.ps1`: writes generated
  `SecretsStage1.h` as UTF-8 without BOM, preserving Unicode Wi-Fi SSIDs.
- `00_Docs/PROJECT_STATUS_REPORT.md`: records the physical Stage 1 result.
- `CODEX_PHASE22B_STAGE1_FINAL_REPORT.md`: this consolidated report.

No ESP32 sensor, calibration, dosing, or pump-control logic was changed.

## 4. Before And After

Before, the Stage 1 preflight was limited to host-side checks. The generated firmware secret
used ASCII, changing the Unicode SSID and preventing Wi-Fi association. The staging dashboard
checker also expected legacy text placement.

After, the ignored runtime secret preserves the SSID as UTF-8, the current HydroFlow SPA passes
the same safety checks, and the physical ESP32 publishes authenticated staging telemetry. The
firmware and backend remain fail-closed for actuator control.

## 5. Technical Decisions

- Kept credentials only in ignored runtime files; no credential is included here or in Git.
- Used UTF-8 without BOM for the generated C header to preserve non-ASCII SSIDs reliably.
- Recompiled after secret generation because Wi-Fi/MQTT staging values are compile-time inputs.
- Kept the firmware profile at `HYDROPONIC_BUILD_PROFILE=1`; operational firmware was not used.
- Used read-only MQTT subscription and database queries for final zero-side-effect evidence.

## 6. Test, Build, And Runtime Evidence

Firmware compile command used Arduino CLI 1.5.1, ESP32 core 3.3.10, ESP32 Dev Module FQBN,
and `compiler.cpp.extra_flags=-DHYDROPONIC_BUILD_PROFILE=1`.

- Compile exit code: 0.
- Flash usage: 938,516 bytes, 71%.
- Static RAM: 47,208 bytes, 14%; 280,472 bytes available.
- Upload exit code: 0; bootloader, partitions, boot app, and application hashes verified.
- USB target: COM5, ESP32-D0WD-V3 revision 3.1.
- Serial: Wi-Fi connected, MQTT connected, command subscription disabled, publish OK.

`npm run stage1:test` passed before physical upload with production endpoints accessed 0,
forbidden pump commands delivered 0, dosing runs 0, and pump logs 0. The first two attempts
exposed stale SPA assertions; after correction and clean staging reset, exit code was 0.

`npm test` after all source changes: exit code 0, 186 passed, 0 failed, 0 skipped.

Physical staging evidence:

- Latest physical identity began `device001:e4f8c4f0c5a6c276:1` and advanced normally.
- Persisted physical sensor logs at first audit: 4.
- Pump Main false, Pump A false, Pump B false.
- Shadow decisions: 4, read-only.
- MQTT pump commands observed during a dedicated 15-second subscription: 0.
- `dosing_runs`: 0; `pump_logs`: 0; Auto Dosing enabled: false.
- Dashboard `/overview`: HTTP 200.

No database migration was required or run in this Stage 1 task.

## 7. Checks Not Performed

- No 12V pump, nutrient line, or actuator was connected or operated.
- No calibration set was created, validated, activated, or retired.
- No production database, broker, credential, topic, or service was accessed.
- Long-duration sensor stability and crop-control validity were not claimed.

## 8. Component Status

- Firmware: compiled, uploaded, and physically running as `USB_STAGE1`.
- Backend: isolated Stage 1 instance connected to isolated MongoDB and MQTT.
- Dashboard/API: HTTP 200 and receiving real `device001` telemetry.
- Database: isolated `hydroponic_stage1_preflight`, physical telemetry only after clean reset.
- Hardware: ESP32 and sensors powered by USB; pump supply and nutrient lines disconnected.

The isolated stack was intentionally left running for inspection:

- Dashboard: `http://127.0.0.1:3101/overview`
- Stop: `03_Edge_Server/mqtt_backend/staging/stage1/Stop-Stage1-Preflight.ps1`
- Reset after evidence collection: `03_Edge_Server/mqtt_backend/staging/stage1/Reset-Stage1-Preflight.ps1`

## 9. Risks And Limits

- Current float input reports `waterLevel=low`; this correctly blocks dosing readiness.
- TDS raw was 0 during the observed USB run and needs inspection with the intended probe setup.
- Initial stability thresholds still need longer supervised physical telemetry review.
- Stage 1 runtime credential files must remain ignored and must be reset after testing when no
  longer required.

## 10. Next Work

1. Observe several minutes of real telemetry on the Stage 1 Dashboard with pumps disconnected.
2. Confirm boot/sequence progression, three distinct measurements, and sensor quality fields.
3. Correct the physical float/TDS test setup if `low` or raw 0 is unexpected.
4. Stop/reset isolated staging after evidence collection.
5. Plan calibration-set work separately; keep Auto Dosing OFF.

## 11. Safety-Critical Source Evidence

- `BuildProfile.h:12-14`: `USB_STAGE1`, actuator lock true, MQTT commands false.
- `MqttService.cpp:90`: command subscription disabled by build profile.
- `Hydroponic_Device001.ino:525,633,775`: MQTT, Serial, and loop-level actuator locks.
- `mqttClient.js:9,104`: backend MQTT publisher lock.
- `pumpCommandService.js:76,125`: backend service lock.
- `Start-Stage1-Preflight.ps1:123-138`: ignored firmware secret generation using UTF-8.

## 12. Secret Confirmation

This report contains no Wi-Fi password, MQTT password, token, MongoDB credential, or production
secret. Runtime credentials remain under ignored `.stage1_runtime/secrets/`; generated
`SecretsStage1.h` is ignored.

## 13. Mandatory Safety Confirmations

- Auto Dosing remained OFF.
- Firmware did not subscribe to the pump-command topic.
- Backend retained both command locks.
- All persisted pump states were OFF.
- Zero pump command, zero dosing run, and zero pump log were verified.
- No pump or nutrient hardware was powered.
- No production endpoint was accessed.
