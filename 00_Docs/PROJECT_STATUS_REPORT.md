# PROJECT STATUS REPORT - Hydroponic_IoT_ESP32

## 1. Last Updated

- Date: 2026-08-11
- Updated by: Codex

## 2. Current Project Phase

- Current phase: Source Consolidation and Workspace Cleanup
- Short description: Accepted Phase 22A Fix 2, Phase 22B Stage 0, and Phase 22B Stage 1 Preflight changes are consolidated in the sole source-of-record repository. Checkpoint commits/tags, provenance manifests, regression evidence, firmware build evidence, and retained reports are in Git. Redundant compare/re-audit/build/baseline/patch trees were removed through the Recycle Bin. Physical USB Stage 1 remains paused and unverified.

## 3. Completed Tasks

| No. | Task | Status | Notes |
|---|---|---|---|
| 1 | T01 through T08 local hardware tests | Done | Passed. |
| 2 | Main Firmware V2 Wi-Fi + MQTT sensor publish | Done | Passed. |
| 3 | Edge Server MQTT to MongoDB | Done | Passed. |
| 4 | Dashboard Web V1 | Done | Passed. |
| 5 | Alert & Data Quality V1 | Done | Passed. |
| 6 | MQTT Pump Command V1 | Done | Passed. |
| 7 | Pump Calibration V1 | Done | Passed. Pump A = 2.000 ml/s, Pump B = 1.800 ml/s. |
| 8 | TDS Calibration V2.1 | Done | Passed for prototype use. |
| 9 | Auto Dosing V1 clean-water safety test | Done | Passed. |
| 10 | Phase 19B Dashboard Form Edit Guard | Done | Implemented. |
| 11 | Main pump continuous ON/OFF control | Done | Phase 20B runtime PASS. |
| 12 | Nutrient Response Logging | Done | Phase 20B runtime PASS. |
| 13 | Auto Dosing V2 closed-loop step dosing | Done | Disabled, main pump safety, clean-water step, real nutrient step, mixing wait, and daily limit tests passed. |
| 14 | Dashboard Phase 20B UI | Done | Runtime PASS. |
| 15 | Auto Dosing monitoring dashboard | Done | Safety summary, daily usage, active/latest run, V1/V2 history, and filters implemented. |
| 16 | Auto Dosing event logging | Done | Important transitions plus throttled repeated skip reasons implemented. |
| 17 | Controlled daily dose reset | Done | Exact confirmation required; no dosing or pump records are deleted. |
| 18 | CSV export tools | Done | Dosing runs, nutrient response tests, and Auto Dosing events implemented. |
| 19 | Phase 20C static verification | Done | Node.js syntax, validator, dashboard ID, and diff checks passed. |
| 20 | Phase 20C runtime test | Done | Monitoring cards, daily usage, V1/V2 runs, event log, and all CSV exports passed. |
| 21 | Phase 20D documentation and runtime report | Done | Runtime evidence, report insert, demo checklist, and review package completed. |
| 22 | Phase 21 EC/TDS safety hardening | Implemented | Automated tests pass; firmware compile and supervised runtime validation remain pending. |
| 23 | Phase 21 Fix Round 1 audit remediation | Implemented | Stability contract, post-mixing timestamp/set guard, atomic run/Pump B claims, transactional lifecycle with checked fallback, migration classification, tests, and docs updated. Runtime remains unverified. |
| 24 | Phase 21 Fix Round 2 cleanup and migration audit hardening | Implemented | Superseded artifacts removed, Phase 20 snapshots archived with warnings, README contradiction fixed, and migration completeness validation/tests expanded. Final verification and review package are recorded below. |
| 25 | Phase 22A firmware compile and Telemetry Identity V2 | Done | Baseline and final compile passed with verified Arduino IDE toolchain; firmware was not uploaded. |
| 26 | Phase 22A duplicate/order/boot protection | Implemented | V2 validation, partial unique identity index, idempotent duplicate path, conservative boot transition, accepted-only latest, and distinct stability implemented. |
| 27 | Phase 22A Shadow Mode | Implemented | Pure 30-gate engine, one decision per accepted measurement, read-only APIs, dashboard status/history, and zero-side-effect tests implemented. Runtime test on operational services is waiting. |
| 28 | Phase 22A Fix 2 independent re-audit | Done | Expired `PROCESSING` lease claim is now atomic by state, lease, and attempt. Full suite: 173 passed, 0 failed, 0 skipped. Full Arduino compile passed; no upload. |
| 29 | Phase 22B Stage 0 isolated staging | Done | Real isolated MongoDB/MQTT/backend/Dashboard runtime PASS on ports 27018/18884/3100. Stop/reset/start repeatability PASS; Auto Dosing OFF, zero pump command, zero dosing run. |
| 30 | Phase 22B Stage 1 Preflight | Partial | LAN MQTT/auth/ACL, topic parity, actuator lock, lifecycle, runtime integration, regression, and full profile compile passed. Physical Wi-Fi path is not configured or tested; no firmware upload or hardware use occurred. |
| 31 | Source Consolidation and Workspace Cleanup | Done | Main Git history preserved; accepted changes merged by verified diff; 181 tests and 47 syntax checks passed; Stage 1 firmware profile compiled; six redundant trees and generated artifacts were removed. |

## 4. Created Folders

No new folders were created for Phase 20C.

Phase 21 created:

- `03_Edge_Server/mqtt_backend/scripts/`
- `03_Edge_Server/mqtt_backend/src/config/`
- `03_Edge_Server/mqtt_backend/test/`

Phase 21 Fix Round 2 created:

- `00_Docs/archive/phase20/`

Phase 22A created no new top-level folders; files were added to existing firmware,
backend service/config/test, and documentation folders.

## 5. Created Files

Phase 20D retained:

- `00_Docs/DEMO_CHECKLIST_AUTO_DOSING.md`

Phase 21:

- `00_Docs/EC_TDS_Calibration.md`
- `03_Edge_Server/mqtt_backend/src/config/tdsQualityConfig.js`
- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationSetValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsQualityService.js`
- `03_Edge_Server/mqtt_backend/src/services/autoDosingReadinessService.js`
- `03_Edge_Server/mqtt_backend/scripts/migrateLegacyTdsCalibrations.js`
- `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js`
- `03_Edge_Server/mqtt_backend/test/autoDosingSafety.test.js`
- `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js`
- `03_Edge_Server/mqtt_backend/test/dashboardContract.test.js`
- `03_Edge_Server/mqtt_backend/test/phase21FixBehavior.test.js`
- `03_Edge_Server/mqtt_backend/testSupport/fakeMongo.js`
- `CODEX_PHASE21_FIX1_FINAL_REPORT.md`

Phase 21 Fix Round 2 creates on final packaging:

- `CODEX_PHASE21_FIX2_FINAL_REPORT.md`
- `Hydroponic_IoT_ESP32_PHASE21_FIX2_REVIEW.zip`

Phase 22A created:

- `00_Docs/Telemetry_Identity_Shadow_Mode.md`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/TelemetryIdentity.h`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/TelemetryIdentity.cpp`
- `03_Edge_Server/mqtt_backend/src/config/phase22Config.js`
- `03_Edge_Server/mqtt_backend/src/services/telemetryIdentityService.js`
- `03_Edge_Server/mqtt_backend/src/services/telemetryPipelineService.js`
- `03_Edge_Server/mqtt_backend/src/services/shadowDosingEngine.js`
- `03_Edge_Server/mqtt_backend/src/services/shadowDosingService.js`
- `03_Edge_Server/mqtt_backend/test/phase22TelemetryIdentity.test.js`
- `03_Edge_Server/mqtt_backend/test/phase22ShadowEngine.test.js`
- `03_Edge_Server/mqtt_backend/test/phase22Pipeline.test.js`
- `CODEX_PHASE22A_FINAL_REPORT.md` (created at final handoff)
- `Hydroponic_IoT_ESP32_PHASE22A_REVIEW.zip` (created at final handoff)

Phase 22A Fix 2 creates at final handoff:

- `CODEX_PHASE22A_FIX2_FINAL_REPORT.md`
- `Hydroponic_IoT_ESP32_PHASE22A_FIX2_REVIEW.zip`

Phase 22B Stage 0 created:

- `03_Edge_Server/mqtt_backend/staging/.env.staging.example`
- `03_Edge_Server/mqtt_backend/staging/mosquitto.stage0.conf`
- `03_Edge_Server/mqtt_backend/staging/Stage0.Common.ps1`
- `03_Edge_Server/mqtt_backend/staging/Start-Staging.ps1`
- `03_Edge_Server/mqtt_backend/staging/Stop-Staging.ps1`
- `03_Edge_Server/mqtt_backend/staging/Reset-Staging.ps1`
- `03_Edge_Server/mqtt_backend/staging/Get-StagingStatus.ps1`
- `03_Edge_Server/mqtt_backend/staging/runStage0Checks.js`
- `03_Edge_Server/mqtt_backend/staging/README.md`
- `03_Edge_Server/mqtt_backend/test/stage0Safety.test.js`
- `CODEX_PHASE22B_STAGE0_REPORT.md`

Source Consolidation created:

- `00_Docs/Phase_Reports/`
- `00_Docs/Patches/`
- `00_Docs/Manifests/`

## 6. Modified Files

Phase 20D:

- `00_Docs/PROJECT_STATUS_REPORT.md`
- `03_Edge_Server/mqtt_backend/README.md`

Phase 21:

- `README.md`
- `00_Docs/PROJECT_PLAN.md`
- `00_Docs/PROJECT_STATUS_REPORT.md`
- `00_Docs/Database_Schema.md`
- `00_Docs/Payload_Format.md`
- `04_Database/mongodb_schema.md`
- `04_Database/sample_payload.json`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.h`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.cpp`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino`
- `03_Edge_Server/mqtt_backend/.env.example`
- `03_Edge_Server/mqtt_backend/package.json`
- `03_Edge_Server/mqtt_backend/README.md`
- `03_Edge_Server/mqtt_backend/public/index.html`
- `03_Edge_Server/mqtt_backend/public/styles.css`
- `03_Edge_Server/mqtt_backend/public/app.js`
- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js`
- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`
- `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js`
- `03_Edge_Server/mqtt_backend/src/validators/sensorPayloadValidator.js`
- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationValidator.js`
- `03_Edge_Server/mqtt_backend/src/validators/autoDosingSettingsValidator.js`

Phase 21 Fix Round 1 additionally modified:

- `README.md`
- `00_Docs/PROJECT_PLAN.md`
- `00_Docs/PROJECT_STATUS_REPORT.md`
- `00_Docs/Database_Schema.md`
- `00_Docs/Payload_Format.md`
- `04_Database/mongodb_schema.md`
- `03_Edge_Server/mqtt_backend/README.md`
- `03_Edge_Server/mqtt_backend/scripts/migrateLegacyTdsCalibrations.js`
- `03_Edge_Server/mqtt_backend/src/config/tdsQualityConfig.js`
- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
- `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js`
- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsQualityService.js`
- `03_Edge_Server/mqtt_backend/src/validators/sensorPayloadValidator.js`
- `03_Edge_Server/mqtt_backend/test/autoDosingSafety.test.js`
- `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js`
- `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js`

Phase 21 Fix Round 2 modified:

- `00_Docs/PROJECT_PLAN.md`
- `00_Docs/PROJECT_STATUS_REPORT.md`
- `03_Edge_Server/mqtt_backend/README.md`
- `03_Edge_Server/mqtt_backend/scripts/migrateLegacyTdsCalibrations.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js`
- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationSetValidator.js`
- `03_Edge_Server/mqtt_backend/test/phase21FixBehavior.test.js`
- `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js`
- `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js`

Phase 21 Fix Round 2 moved and labeled historical:

- `00_Docs/PHASE_20B_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20B_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20C_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20C_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20D_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20D_REVIEW_PACKAGE.md`

Phase 21 Fix Round 2 deleted as superseded:

- `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip`
- `_phase21_review/` and its ten pre-Fix1 log files
- `CODEX_PHASE21_FINAL_REPORT.md`
- `00_Docs/PHASE_20B_20C_REPORT_INSERT.md`

Retained conditionally:

- `00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md` remains because no canonical Phase 20D DOCX exists in the repository.

Phase 22A Fix 2 modified:

- `00_Docs/PROJECT_STATUS_REPORT.md`: records the independent audit, defect, verification, and handoff state.
- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`: makes expired processing-lease claims atomic with lease/attempt compare-and-set filters.
- `03_Edge_Server/mqtt_backend/test/phase22aFix1.test.js`: adds concurrent expired-lease retry regression coverage.

Phase 22B Stage 0 modified:

- `.gitignore`: excludes generated Stage 0 runtime data and logs.
- `README.md`: records Phase 22A Fix 2 compile evidence and Stage 0 commands.
- `00_Docs/Telemetry_Identity_Shadow_Mode.md`: replaces stale Fix 1 runtime status and documents Fix 2 recovery plus Stage 0 evidence.
- `00_Docs/PROJECT_STATUS_REPORT.md`: records Stage 0 files, runtime results, safety state, and next task.
- `03_Edge_Server/mqtt_backend/package.json`: adds `stage0:test`.
- `03_Edge_Server/mqtt_backend/src/httpServer.js`: supports an optional bind host so Stage 0 is loopback-only.
- `03_Edge_Server/mqtt_backend/src/mqttClient.js`: adds environment pump-publisher lock.
- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js`: rejects manual pump service paths when staging lock is enabled.

Source Consolidation added or updated:

- `.gitignore`: consolidated credential, dependency, runtime, build, cache, log, binary, and archive exclusions.
- `00_Docs/Phase_Reports/`: retained accepted audit and phase reports.
- `00_Docs/Patches/`: retained the secret-safe Stage 1 patch.
- `00_Docs/Manifests/`: retained pre-cleanup inventory, transfer hashes, checkpoint hashes, parity, provenance, and post-cleanup verification.
- `00_Docs/PROJECT_STATUS_REPORT.md`: records the sole source-of-record state and cleanup result.

## 7. Hardware Pin Map Confirmed

| Function | GPIO | Status |
|---|---|---|
| TDS SEN0244 AOUT | GPIO34 | Confirmed |
| DS18B20 DATA | GPIO4 | Confirmed |
| Water level float switch | GPIO27 | Confirmed |
| Pump Main / MOSFET CH1 IN1+ | GPIO25 | Confirmed |
| Pump A / MOSFET CH2 IN2+ | GPIO26 | Confirmed |
| Pump B / MOSFET CH3 IN3+ | GPIO14 | Confirmed |
| Spare / MOSFET CH4 IN4+ | GPIO33 | Confirmed |

## 8. MQTT Topics Confirmed

| Topic | Direction | Purpose | Current Status |
|---|---|---|---|
| `hydroponic/device001/sensor` | ESP32 -> Backend | Sensor/status data | Existing flow preserved |
| `hydroponic/device001/pump/cmd` | Backend -> ESP32 | Pulse commands and main pump set on/off | Extended in Phase 20B |
| `hydroponic/device001/pump/status` | ESP32 -> Backend | Pump started/completed/rejected/set_on/set_off status | Extended in Phase 20B |
| `hydroponic/device001/alert` | Backend/DB/Dashboard | Alerts | Existing flow preserved |

## 9. Current Code Status

- Main pump continuous control: Implemented for `pump=main`, `action=set`, `state=on/off`.
- Pump A/B continuous control: Not allowed; A/B remain pulse-only.
- Main pump ON backend validation: allowed only when latest water level is `normal`.
- Main pump OFF backend validation: always allowed.
- ESP32 firmware accepts `action=set` only for main pump and publishes `set_on` / `set_off` pump status.
- `pump_logs` accepts and stores pulse status plus set status.
- Nutrient Response Logging: Implemented with `nutrient_response_tests`, backend-calculated averages, deltas, and ppm-per-pair estimate.
- Nutrient Response dashboard: Implemented with latest test, summary, history, and fill-from-latest-logs buttons.
- Auto Dosing V2: Implemented as closed-loop step dosing.
- Auto Dosing V2 default: disabled.
- Auto Dosing V2 dosing step: Pump A pulse first, then Pump B pulse, then `mixing_wait`.
- Auto Dosing V2 completion: after `mixingUntil`, only a fresh control-valid sensor payload with `measurementAt > mixingUntil` from the same still-active calibration set may complete the run with `tdsPpmAfterMixing` and `deltaTdsPpm`.
- Auto Dosing V2 safety: Phase 21 requires explicit active-set identity, at least three valid EC points, in-range compensated data, `tdsStable === true`, `tdsControlValid === true`, confirmed cải ngọt targets, water/main-pump interlocks, Pump A/B calibration, active-run exclusion, duration limits, and daily dose limit.
- EC/TDS calibration: uses explicit draft/active/retired sets and in-range piecewise EC interpolation with scale 500; latest-ten-point mixing and control extrapolation are removed.
- Measurement stability: firmware uses a nonblocking 30-sample median window; backend requires three matching stable payloads in 120 seconds.
- Measurement stability Fix 1: validator and stability service independently require exactly 30 samples, spread <= 50 raw ADC, and a matching `tdsWindowStable` boolean.
- Measurement timestamp: accepted rows and `devices.latest` store the same server-side `measurementAt`.
- Post-mixing completion: requires `measurementAt > mixingUntil`, a fresh control-valid reading, and the same still-active valid calibration set stored in `tdsCalibrationSetIdAtStart`.
- Dosing concurrency: a unique partial active lock reserves one new active run per device; Pump B is atomically claimed as `publishing` before MQTT publish; duplicate/out-of-order statuses are ignored.
- Calibration lifecycle: transaction path uses `startSession()/withTransaction()` when supported; standalone fallback checks write results and rolls back target, previous set, and pointer including first activation.
- Legacy migration: scans all rows and uses the activation validator's full persisted-point completeness helper. A modern row requires valid device/set identity, raw/voltage relationship, EC and scale-500 TDS relationship, temperature compensation metadata, voltage25 relationship, and method. Default remains dry-run; apply only marks legacy audit fields and never activates or infers calibration values.
- Auto Dosing Phase 21 default: OFF. Existing numeric targets are unconfirmed and cannot enable dosing until explicitly confirmed for cải ngọt.
- Dashboard Auto Dosing form edit guard: preserved.
- Phase 20B runtime: passed, including real nutrient one-step from 302.27 ppm to 348.88 ppm, delta +46.61 ppm after a 1 ml A + 1 ml B step and 15-minute mixing delay.
- Auto Dosing monitoring: safety state, target/current TDS, pump and water status, calibration readiness, active run, latest completed V2 run, and daily usage are displayed.
- Auto Dosing events: stored in `auto_dosing_events`; settings and run transitions are logged, while repeated skip reasons are deduplicated for 5 minutes by default.
- Daily usage: calculated from local day start or the latest same-day `manual_daily_reset` event.
- Daily reset: prototype-only, requires exact `RESET DAILY DOSE`, does not delete `dosing_runs`, and does not modify `pump_logs`.
- Dosing run history: V1 legacy and V2 closed-loop runs remain visible and filterable.
- CSV export: available for `dosing_runs`, `nutrient_response_tests`, and `auto_dosing_events`.
- Settings guardrails: mixing delay minimum 60000 ms, step <= per-run maximum, per-run maximum <= daily maximum, enable confirmation, testing delay warning, and disabled presets.
- Hybrid Local-first alignment: dosing logic runs locally on the Hydroponic Edge AI Gateway / Local Control Server represented by the local Node.js backend + MQTT broker + dashboard.
- MongoDB remains in use for this prototype.

## 10. Phase 20B–20C Runtime Validation Summary

### Phase 20B - Closed-loop Step Dosing Runtime Validation

| Test | Status | Verified Result |
|---|---|---|
| Main Pump Continuous Control | PASS | Dashboard ON/OFF works; `set_on` and `set_off` are stored in `pump_logs`. |
| Pump Pulse Regression Test | PASS | Existing pulse commands still work for main pump, Pump A, and Pump B. |
| Pump A/B Continuous Rejection | PASS | Pump A/B `set/on` commands are rejected with `Rejected: set action is only allowed for main pump`. |
| Nutrient Response Logging | PASS | Test 4 saved; backend correctly calculated dashboard and handheld-meter averages and deltas. |
| Auto Dosing Disabled Safety | PASS | `lastEvaluationReason=disabled`; no new dosing run was created. |
| Main Pump OFF Interlock | PASS | `lastEvaluationReason=main_pump_not_running`; no Pump A/B command or dosing run was created. |
| Clean-water/Cup One-step Sequence | PASS | Pump A -> Pump B -> `mixing_wait` -> completed; Auto Dosing was turned OFF after the test. |
| Real Nutrient One-step Sequence | PASS | One conservative A/B step increased TDS after 15 minutes of mixing. |
| Daily Dose Limit | PASS | `daily_dose_limit_reached` blocked additional dosing after the configured limit. |

### Phase 20C - Monitoring and Export Runtime Validation

| Test | Status | Verified Result |
|---|---|---|
| Safety Summary Dashboard | PASS | Safety Summary, Active Run, Latest Completed Run, and Simple Trend Preview display correctly. |
| Daily Dose Usage Card | PASS | Used, maximum, remaining, calculation window, runs counted, and reset control are visible. |
| V1/V2 Dosing Runs Table | PASS | Legacy V1 and `closed_loop_step` V2 records are distinguished and displayed. |
| Auto Dosing Event Log | PASS | Events including `disabled`, `settings_updated/enabled`, and `main_pump_not_running` are recorded. |
| CSV Export Tools | PASS | Dosing runs, nutrient response tests, and Auto Dosing events CSV files download with data. |

Example verified safety event:

| Field | Value |
|---|---|
| Type | `skip` |
| Reason | `main_pump_not_running` |
| TDS | 518.14 ppm |
| Main pump | OFF |
| Water level | `normal` |
| Message | `main_pump_not_running` |

### Real Nutrient One-step Result

| Field | Result |
|---|---|
| Run ID example | `dose_1785315812717_16a3363c` |
| Mode | `closed_loop_step` |
| Status | `completed` |
| TDS at start | 302.27 ppm |
| TDS after mixing | 348.88 ppm |
| Delta TDS | +46.61 ppm |
| Dose | 1 ml Pump A + 1 ml Pump B |
| Pump A | 500 ms, completed |
| Pump B | 556 ms, completed |
| Mixing delay | 900000 ms / 15 minutes |
| Water level after mixing | `normal` |
| Result | `positive_response` |

### Safety Mechanisms Verified

- Auto Dosing OFF prevents dosing and new run creation.
- Main pump OFF blocks Auto Dosing when `requireMainPumpOn=true`.
- Water level safety remains required.
- Pump A and Pump B remain pulse-only and sequential.
- Pump A/B continuous `set/on` commands are rejected.
- Daily dose limit blocks additional steps.
- Dosing runs, pump status, nutrient response, and Auto Dosing events are retained as evidence.
- Auto Dosing remains disabled by default and should only be enabled during supervised tests or controlled operation.

### Final Phase Status

- Phase 20B: PASS runtime prototype.
- Phase 20C: PASS runtime prototype.
- Core Auto Dosing V2: functional under supervised prototype conditions.
- Auto Dosing should remain disabled by default.

### Phase 21 Fix Round 1 Verification

| Check | Result | Notes |
|---|---|---|
| `npm test` | PASS | 62 tests passed; includes behavioral fake-DB concurrency, lifecycle failure injection, post-mixing, stability-contract, and migration tests. No operational MongoDB or MQTT used. |
| `node --check` | PASS | 34 backend, dashboard, migration, test, and fake repository JavaScript files passed. |
| JSON parse | PASS | `package.json` and Phase 21 sample payload parsed. |
| Legacy migration fixture dry-run | PASS | Missing/null/empty/incomplete rows classified; zero writes. No live migration was run. |
| Legacy control path search | PASS | No latest-10, one-point fallback, ppm-factor, or extrapolated control path remains in active JS. |
| Firmware compile | NOT RUN | `arduino-cli` is not installed on this machine. |
| Hardware/runtime test | WAITING | Phase 21 firmware, dashboard, active-set lifecycle, and stability need user validation. |

### Phase 21 Fix Round 2 Verification

| Check | Result | Notes |
|---|---|---|
| `npm test` | PASS | 84 tests passed, 0 failed, 0 skipped. Added per-field modern calibration metadata, reason-count, zero-write, and no-inference coverage. |
| `node --check` | PASS | 34 backend, dashboard, migration, test, and fake repository JavaScript files passed. |
| JSON parse | PASS | `package.json` and `04_Database/sample_payload.json` parsed successfully. |
| Migration fixture dry-run | PASS | 1 targeted test passed; fake database writes remained zero. No operational migration was run. |
| Cleanup verification | PASS | Four superseded paths absent, three archive banners present, and the conditional DOCX review note retained. |
| Active documentation contradiction search | PASS | No optional/false-only stability wording, old 37/32 counts, or no-transaction claim remains in active docs. |
| Active control legacy search | PASS | No latest-10, calibration-factor, raw-voltage fallback, old interpolation method, or `tdsStable === false` path remains in active JS. |
| `git diff --check` | PASS | Exit 0; Windows LF-to-CRLF warnings only. |
| Firmware compile | NOT RUN | `arduino-cli` is not installed on this machine. |
| Operational runtime | WAITING | No service, MongoDB, MQTT, dashboard browser, calibration lifecycle, or hardware runtime was used. |

## 11. Known Issues and Limitations

- Auto Dosing V2 is rule-based closed-loop step dosing, not Adaptive Dosing.
- Daily reset changes only the software calculation window and cannot remove nutrient physically added to the reservoir.
- Event logging is monitoring-only; failures are warned without interrupting the working dosing sequence.
- Phase 22A Fix 2 full Arduino compile passed with the verified ESP32 toolchain; firmware upload and ESP32/hardware runtime remain untested.
- MongoDB transaction behavior and unique partial indexes are tested with a fake repository but not verified on the operational MongoDB topology/data.
- Operational migration dry-run has not run because it would connect to the database.
- Migration completeness is tested with fake rows only; it has not been compared with a sanitized copy of operational calibration data.
- Phase 22A adds firmware `measurementId`/sequence and requires three distinct accepted V2 measurements; duplicate, legacy, out-of-order, old-boot, and unconfirmed-boot rows do not count.
- The initial raw-spread and three-payload stability thresholds need confirmation from real logs.
- Existing TDS calibration rows are legacy and are not valid for automatic control.
- No active EC calibration set was created or activated during this task.
- The two ordered Hanna HI70031 packets have no measurement result and represent only one distinct EC reference.
- Auto Dosing does not auto-start the main pump in this phase.
- Handheld TDS meters still differ in absolute readings.
- The TDS sensor can be affected by bubbles, probe cleanliness, and mixing state.
- Auto Dosing has only been validated for conservative small-step dosing under supervision, not fully autonomous long-term cultivation.
- pH remains `null`.
- No authentication yet.
- No SQLite/PostgreSQL migration.
- Cloud/Fleet Management remains architectural only.
- No Device Enrollment, AI Model OTA, Zalo OA, or AI Camera.
- Stage 0 is loopback-only and intentionally anonymous; it is not a production security configuration.
- `npm audit` still reports indirect `body-parser` (low) and `ip-address` (high) findings; no dependency was automatically upgraded in Stage 0.
- Physical USB Stage 1 remains unverified: no staging Wi-Fi credential was configured, no firmware was uploaded, and no ESP32 or hardware was connected during consolidation.
- `D:\Hydroponic_IoT_ESP32.rar` was not deleted because it was not one of the exact authorized cleanup targets and was not used as source.
- Four Phase 21/22 artifacts remain under `D:\Download` because that directory is outside the authorized project cleanup scope; retained in-source copies have matching hashes where applicable.

## 12. Next Recommended Direction

"Review `00_Docs/Phase_Reports/CODEX_SOURCE_CONSOLIDATION_REPORT.md`, then resume the
supervised Physical USB Stage 1 procedure from the consolidated source. Keep Auto Dosing OFF,
nutrient bottles disconnected, and pump power removed."

Do not connect nutrient bottles or enable Auto Dosing during this validation.

### Future Phase 20D DOCX Updates

The Phase 20D DOCX was not found in the current repository and was not edited. Its next
revision should update: demo crop to cải ngọt; EC-first calibration; scale 500/factor 0.5;
calibration-set lifecycle; measurement quality contract; fail-closed Auto Dosing; legacy
limitations; initial stability-threshold caveat; and the pending Hanna measurement workflow.

## 13. Notes for ChatGPT Web

Phase 21 Fix Round 2 removes superseded pre-Fix1 artifacts, archives Phase 20 snapshots with
explicit historical warnings, fixes the remaining fail-open README sentence, and makes
migration auditing share the full modern-point completeness contract with activation.
All 84 isolated tests and 34 syntax checks pass. Runtime remains pending. Auto Dosing remains
OFF; no pump command was sent, no live calibration set was activated or retired, no MQTT
message was published, and no production database was read or modified.

## 14. Phase 22A Handoff

### Modified Files

- `README.md`: current phase and Phase 22A safety state.
- `00_Docs/PROJECT_PLAN.md`: Phase 22A roadmap entry.
- `00_Docs/PROJECT_STATUS_REPORT.md`: implementation and verification status.
- `00_Docs/Payload_Format.md`: complete Telemetry Identity V2 payload contract.
- `00_Docs/Database_Schema.md`: telemetry session, unique indexes, and Shadow collection.
- `04_Database/mongodb_schema.md`: Phase 22A MongoDB summary.
- `04_Database/sample_payload.json`: V2 fixture.
- Firmware `Config.h`, `Hydroponic_Device001.ino`, `MqttService.cpp`,
  `PayloadBuilder.h`, and `PayloadBuilder.cpp`: schema V2 serialization and retry identity.
- Backend `.env.example` and `README.md`: independent Shadow configuration and operation notes.
- Backend `public/index.html`, `public/styles.css`, and `public/app.js`: identity/Shadow UI and locked Auto Dosing enable control.
- Backend `src/mongoClient.js`: V2 partial unique and Shadow indexes.
- Backend `src/mqttClient.js`: production telemetry pipeline; no Auto Dosing call.
- Backend `src/routes/deviceRoutes.js`: read-only Shadow APIs.
- Backend `src/services/autoDosingService.js`: Phase 22A runtime lock with explicit isolated-regression bypass.
- Backend `src/services/sensorLogService.js`: V2 ingestion, duplicate/order exclusion, accepted-only latest.
- Backend `src/services/tdsQualityService.js`: same-boot distinct-measurement stability.
- Backend `src/validators/sensorPayloadValidator.js`: V2 identity validation.
- Backend `test/dashboardContract.test.js`, `test/phase21FixBehavior.test.js`, and
  `testSupport/fakeMongo.js`: Phase 22 contracts and preserved Phase 21 regression.

### Verification

- Baseline tests: 84 passed, 0 failed.
- Current tests: 166 passed, 0 failed, 0 skipped.
- Baseline firmware compile: PASS, flash 941080 bytes (71%), static RAM 47152 bytes (14%).
- Phase 22A firmware compile: PASS, flash 943508 bytes (71%), static RAM 47208 bytes (14%).
- Backend/dashboard JavaScript syntax: PASS.
- Runtime: NOT TESTED against operational MongoDB, MQTT, browser dashboard, ESP32, or hardware.

### Safety State

- Auto Dosing: locked OFF in production source and dashboard.
- Shadow Mode: disabled by default; observation-only when enabled by environment.
- Pump A -> Pump B -> mixing-wait implementation: retained but unreachable from production telemetry in Phase 22A.
- No production DB access, operational MQTT publish, calibration activation/retirement,
  firmware upload, or physical pump operation occurred.

### Next Recommended Task

Historical recommendation completed by Phase 22B Stage 0. See Section 17 for current
runtime evidence and the USB Stage 1 recommendation.

## 15. Phase 22A Fix 1 - Independent Re-audit Remediation

The independent re-audit classified Phase 22A as `PARTIAL` and identified four gaps.
Fix 1 implements the following without enabling Auto Dosing or connecting operational
MongoDB/MQTT/hardware:

1. Freshness uses a same-boot uptime anchor instead of treating a new `receivedAt` as a
   new sample time. Unanchored or impossible timing is fail-closed.
2. Sensor rows use a recoverable processing state and lease. Failed and pre-Fix-1 stuck
   `PROCESSING` rows can resume safely without inserting a second row or re-running an
   already persisted accepted-order decision.
3. Shadow daily-dose accounting calls Phase 21 `getDailyDoseUsage()`, including manual
   reset windows and active runs.
4. Firmware sequence/retry state now executes in a native C++ host harness. Dashboard V2,
   legacy, and missing-hypothetical-value rendering executes against the production
   `public/app.js` functions in a DOM harness instead of source-string assertions alone.

New/modified implementation files include `TelemetrySequence.h`,
`TelemetryPublishState.h`, `TelemetryIdentity.cpp`, `Hydroponic_Device001.ino`,
`sensorLogService.js`, `tdsQualityService.js`, `telemetryPipelineService.js`,
`shadowDosingEngine.js`, `shadowDosingService.js`, `fakeMongo.js`, Dashboard/firmware
tests, and `phase22aFix1.test.js`.

Fix 1 was independently re-audited from its verified source ZIP. The audit found a real race
where two near-simultaneous retries could both claim the same expired `PROCESSING` lease.
Phase 22A Fix 2 closes that race and adds permanent regression coverage.

## 16. Phase 22A Fix 2 - Final Independent Verification

### Fix

- Expired `PROCESSING` retries now claim with an atomic filter requiring the expected
  `processingState`, expired `processingLeaseUntil`, and matching `processingAttempt`.
- A concurrent regression test proves exactly one retry is accepted, one is idempotently
  classified as duplicate, one sensor log and one Shadow decision remain, and no dosing run
  is created.

### Verification

- Full backend suite: 173 passed, 0 failed, 0 skipped; exit code 0.
- JavaScript syntax: 43 files passed; exit code 0.
- Dashboard DOM/runtime: 8 passed, 0 failed, 0 skipped; exit code 0.
- Native firmware host harness: compiled with `g++ -std=c++17 -Wall -Wextra -Werror` and ran; both exit code 0.
- Full Arduino firmware compile: exit code 0 using Arduino CLI 1.5.1, ESP32 core 3.3.10,
  and the required Phase 22A FQBN. Flash: 943700 bytes (71%). Static RAM: 47208 bytes (14%).
- Isolated migration dry-run test: 1 passed, 0 writes; no operational database connection.
- Dependency audit: 2 indirect findings remain (`body-parser` low, `ip-address` high); no
  automatic dependency rewrite was made during this safety-focused audit.

### Safety

- Auto Dosing remains locked OFF.
- Shadow Mode has no MQTT publisher and no dosing-run writer.
- No operational MQTT publish, production database access, calibration lifecycle change,
  firmware upload, or physical pump operation occurred.
- GPIO assignments remain 34, 4, 27, 25, 26, 14, and 33.

### Next Recommended Task

Proceed to USB Stage 1 with Auto Dosing OFF, nutrient bottles disconnected, and no pump
power. Connect only a staging ESP32 after reviewing the Stage 0 report, then verify real
telemetry identity and Shadow observation against the isolated ports/topics.

## 17. Phase 22B Stage 0 - Isolated Staging Runtime

### Isolation

- MongoDB: `mongodb://127.0.0.1:27018`, database `hydroponic_stage0`.
- MQTT: `mqtt://127.0.0.1:18884`.
- Backend and Dashboard: `http://127.0.0.1:3100`.
- MQTT topics use the `stage0/hydroponic/device001/` prefix.
- Existing default services on MongoDB 27017 and MQTT 1883 were not used.
- The sample configuration contains no credential. Runtime data stays under the ignored
  `staging/.stage0_runtime/` directory.

### Runtime Result

- Start/health: PASS for isolated MongoDB, MQTT, backend, Shadow Mode, API, and Dashboard.
- Stage 0 end-to-end check: PASS on two runs separated by stop/reset/start.
- Telemetry Identity V2, boot transition, duplicate/retry idempotency, out-of-order,
  delayed freshness, and three distinct measurements: PASS.
- Sensor logs: 9. Shadow decisions: 7. Stable distinct measurements: 3.
- Delayed measurement: rejected for control with `tds_measurement_stale`.
- API and Dashboard: PASS, Dashboard HTTP 200.
- Auto Dosing enabled: false.
- Pump command messages observed: 0.
- Pump logs: 0. Dosing runs: 0.
- Manual pulse/main API attempts: rejected by `pump_commands_disabled`.

### Firmware And Hardware

Firmware was not modified in Stage 0, so it was not recompiled. The Phase 22A Fix 2 full
compile remains the current evidence. No firmware upload, ESP32 connection, or physical
hardware operation occurred.

### Stage 0 Conclusion

`READY_FOR_USB_STAGE1`
