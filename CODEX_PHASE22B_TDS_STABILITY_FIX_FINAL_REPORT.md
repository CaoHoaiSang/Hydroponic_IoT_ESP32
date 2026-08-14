# CODEX PHASE 22B TDS STABILITY FIX FINAL REPORT

> Historical stability-fix report. The recommended longer observation below applies only
> before unattended automatic dosing; it is not a current gate for continued development.

## 1. Scope And Objective

This change fixes false TDS instability observed during the physical USB Stage 1 test. The
calibrated median matched the handheld meter, but a small number of ESP32 ADC extrema often
pushed the original full-window spread above 50 counts. The implementation keeps the system
fail-closed, adds robust diagnostics, and preserves the actuator and Auto Dosing locks.

## 2. Requirement Status

| Requirement | Status | Evidence |
|---|---|---|
| Robust ADC-window calculation | Complete | 30 samples, 3 trimmed per side, 24 retained. |
| Retained spread limit | Complete | Maximum 50 raw counts. |
| Full-window safety cap | Complete | Maximum 80 raw counts. |
| Backend independent validation | Complete | Bounds, count, spread equations, median containment, and boolean relationship checked. |
| Uptime-anchor jitter consistency | Complete | Shared 5-second future-skew limit; larger skew fails closed. |
| Legacy payload safety | Complete | Payloads without robust fields remain limited to full spread 50. |
| Persistence in sensor logs/device latest | Complete | All robust fields stored. |
| Automated regression | Complete | 198 passed, 0 failed, 0 skipped. |
| USB Stage 1 firmware compile | Complete | Exit 0, ESP32 core 3.3.10. |
| Physical upload and flash verification | Complete | COM5 upload exit 0; every written image hash verified. |
| Physical stability runtime | Complete | Three distinct measurements reached stable/control-valid. |
| 30-minute read-only telemetry soak | Complete | 60 contiguous measurements passed with zero pump commands, pump logs, or dosing runs. |
| Auto Dosing or pump operation | Not performed | Explicitly prohibited and remained locked OFF. |

## 3. Files Created Or Modified

- `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h`: robust and absolute thresholds.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.h`: robust telemetry fields.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.cpp`: trimmed-window calculation.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp`: publish robust diagnostics.
- `03_Edge_Server/mqtt_backend/src/config/tdsQualityConfig.js`: mirrored backend constants.
- `03_Edge_Server/mqtt_backend/src/config/phase22Config.js`: shared verified future-skew limit.
- `03_Edge_Server/mqtt_backend/src/validators/sensorPayloadValidator.js`: complete payload contract validation.
- `03_Edge_Server/mqtt_backend/src/services/tdsQualityService.js`: independent fail-closed quality check.
- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`: persistence and current-candidate fields.
- `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js`: validator boundary tests.
- `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js`: robust-window and forged-spread tests.
- `03_Edge_Server/mqtt_backend/test/phase22TelemetryIdentity.test.js`: complete fixtures and payload budget.
- `03_Edge_Server/mqtt_backend/staging/stage1/Restart-Stage1-Backend.ps1`: scoped, secret-safe backend reload.
- `03_Edge_Server/mqtt_backend/staging/stage1/Run-Stage1-TelemetrySoak.ps1`: repeatable read-only soak with Windows standby prevention and fail-closed acceptance checks.
- `03_Edge_Server/mqtt_backend/staging/stage1/README.md`: backend restart command.
- `03_Edge_Server/mqtt_backend/README.md`: robust stability contract.
- `00_Docs/Payload_Format.md`: payload and stored quality fields.
- `00_Docs/PROJECT_STATUS_REPORT.md`: implementation and physical runtime status.
- `README.md`: current stability architecture.
- `CODEX_PHASE22B_TDS_STABILITY_FIX_FINAL_REPORT.md`: this handoff.

## 4. Logic Before And After

Before:

```text
stable = sampleCount == 30 && (maximum - minimum) <= 50
```

One or two harmless ADC extrema could invalidate an otherwise steady median.

After:

```text
sort 30 samples
robustMin = sorted[3]
robustMax = sorted[26]
retainedCount = 24
stable = retainedCount == 24
      && (robustMax - robustMin) <= 50
      && (maximum - minimum) <= 80
```

The original minimum, maximum, and full spread remain observable. The 80-count hard cap means
trimming cannot hide a materially noisy window. Backend validation recomputes every reported
relationship and does not trust `tdsWindowStable` alone.

## 5. Technical Decisions

- Trim exactly 10% per side because the real 30-sample windows had stable medians but sparse
  extrema. At least 80% of the window must still fit the original 50-count central limit.
- Keep a separate 80-count absolute cap to fail closed on larger disturbances.
- Keep robust fields additive under telemetry schema V2. Legacy firmware is not granted the
  new absolute cap and must satisfy the original full-spread rule.
- Keep the backend service check independent from request validation, including both spread
  equations and bound ordering.
- Reuse the telemetry identity service's 5-second verified future-skew limit. Real uptime-derived
  timestamps varied by only 25-45 ms around receipt time; rejecting every negative age caused
  intermittent false instability, while accepting more than 5 seconds would weaken freshness.
- Restart only the isolated Stage 1 backend after backend changes. MongoDB, MQTT, and the
  firmware runtime secret were not replaced.

## 6. Verification Results

### Targeted tests

```powershell
node --test test/tdsCalibration.test.js test/stabilityMigration.test.js test/phase22TelemetryIdentity.test.js
```

Exit code `0`: 96 passed, 0 failed.

### Final regression

```powershell
npm test
```

Exit code `0`: 198 passed, 0 failed, 0 skipped.

An intermediate stricter quality-service run exposed eight incomplete test fixtures. Production
checks were not relaxed; the current candidate and fixtures were completed, then the full suite
passed. A later physical soak exposed intermittent 25-45 ms uptime-anchor future jitter; three
boundary tests were added and the final suite passed 198/198.

### JavaScript syntax

```powershell
node --check <each JavaScript file under src, test, staging, scripts, testSupport>
```

Exit code `0`: 50 files passed. Modified services were checked again after the final hardening.

### Firmware compile

```powershell
arduino-cli compile `
  --fqbn "esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default" `
  --build-path D:\Hydroponic_PHASE22B_TDS_STABILITY_BUILD_20260814 `
  --build-property "compiler.cpp.extra_flags=-DHYDROPONIC_BUILD_PROFILE=1" `
  02_ESP32_Main_Firmware\Hydroponic_Device001
```

Exit code `0`:

- Flash: 938,792 / 1,310,720 bytes, 71%.
- Static RAM: 47,240 / 327,680 bytes, 14%.
- Remaining dynamic memory: 280,440 bytes.

### Physical upload

The first attempt exited `1` because the ESP32 was not in download mode. No flash write began.
After the operator held BOOT, the same compiled binary was uploaded to COM5 with `--verify`.

Final exit code `0`: bootloader, partition table, boot app, and application hashes verified.

### Physical runtime

Final accepted snapshot:

```json
{
  "tdsRaw": 2528,
  "tdsSpreadRaw": 27,
  "tdsRobustSpreadRaw": 20,
  "tdsTrimmedSampleCount": 24,
  "ecUsCm": 1340.53,
  "tdsPpm": 670.27,
  "tdsStable": true,
  "tdsControlValid": true
}
```

Handheld reference was 673 ppm, approximately -0.4% difference. The preceding acceptance
sequence reached three distinct measurements before control validity became true.

After the timestamp consistency fix and backend restart, five consecutive measurements
(`seq 21-25`) all reported `tdsWindowStable=true`, `tdsStable=true`, and
`tdsControlValid=true`. Their full spreads were 23-30, robust spreads 16-20, and TDS values
665.41-665.98 ppm.

### 30-minute read-only telemetry soak

```powershell
.\staging\stage1\Run-Stage1-TelemetrySoak.ps1 -DurationMinutes 30
```

Exit code `0`, final result `pass=true`:

- UTC window: `2026-08-14T05:47:46.063Z` to `2026-08-14T06:17:46.217Z`.
- Sequence: 60 contiguous measurements, `88-147`, one boot, all accepted.
- Timing: average interval `30.00 s`, maximum interval `30.105 s`.
- Quality: every firmware window stable, backend TDS stable, and control-valid.
- Full ADC spread: min `25`, average `32.37`, max `51` counts.
- Robust ADC spread: min `11`, average `18.53`, max `27` counts.
- TDS: min `662.70`, average `664.79`, max `666.84 ppm`; standard deviation `0.90 ppm`.
- Water level: normal for every measurement; Pump Main/A/B: OFF for every measurement.
- Broker log pump-command count: `0`.
- Auto Dosing: `false`; Phase 22 lock: `true`.
- Isolated health at completion: backend, MongoDB, and MQTT all healthy.

Direct post-soak checks against `hydroponic_stage1_preflight` found `dosing_runs=0` and
`pump_logs=0`. The first attempted soak window was discarded as inconclusive after Windows
Connected Standby caused an approximately 8.5-minute telemetry gap. The repeatable runner now
uses `SetThreadExecutionState` and the clean 30-minute rerun had no gap or reconnect.

## 7. Component Status

- Firmware: compiled, uploaded, verified, and publishing robust telemetry as `USB_STAGE1`.
- Backend: running on isolated Stage 1 and validating the new contract.
- Dashboard/API: serving from `http://127.0.0.1:3101/` with current device data.
- Database: isolated `hydroponic_stage1_preflight` on `127.0.0.1:27019` only.
- MQTT: authenticated Stage 1 broker on port `18885`; pump command publication remains blocked.
- Hardware: ESP32 and sensors observed; 12 V pump operation was not performed.

## 8. Safety Evidence

- Firmware thresholds: `Config.h:27-29`.
- Firmware robust calculation and hard cap: `Sensors.cpp:72-87`.
- Firmware actuator lock: `BuildProfile.h:13`.
- Payload fields: `PayloadBuilder.cpp:87-104`.
- Validator complete-field and relationship checks: `sensorPayloadValidator.js:64-109`.
- Independent quality checks: `tdsQualityService.js:27-50`.
- Shared future-skew limit: `phase22Config.js` and `tdsQualityService.js`.
- Stage 1 backend publisher lock: `Restart-Stage1-Backend.ps1:30`.
- Auto Dosing source lock remains present: `autoDosingService.js:113`.

Final isolated database/API evidence:

- Auto Dosing enabled: `false`.
- Phase 22 lock: `true`.
- Pump Main/A/B: all `false`.
- `dosing_runs`: `0`.
- `pump_logs`: `0`.
- No MQTT pump command was published.
- No calibration set was created, changed, activated, or retired by this fix.

## 9. Risks And Unverified Areas

- The thresholds passed a continuous 30-minute test for the current sensor, ESP32, wiring,
  reservoir, and Wi-Fi environment. Multi-day drift and electrical conditions with 12 V loads
  powered remain untested.
- This result makes telemetry control-valid; it does not authorize Auto Dosing or pump power.
- pH remains unavailable and authentication outside isolated staging is still not implemented.
- Production database, production broker, production credentials, and production topics were
  not accessed.

## 10. Next Priority

Keep Auto Dosing and the 12 V pump supply OFF. Review this telemetry baseline, then prepare a
separate supervised actuator-stage plan with explicit wiring, abort, current, and dry-run
checks before reconnecting any pump power. A longer 12-24 hour read-only drift observation is
recommended before autonomous operation.

## 11. Secret Confirmation

No Wi-Fi password, MQTT password, MongoDB credential, token, or other secret is included in
this report or tracked source changes. Runtime credentials and `SecretsStage1.h` remain in
Git-ignored locations.
