# PROJECT STATUS REPORT - Hydroponic_IoT_ESP32

## 1. Last Updated

- Date: 2026-08-16
- Updated by: Codex

## 2. Current Project Phase

- Current phase: Phase 23D - EC Probe Duty-Cycle Protection
- Short description: GPIO32 controls the validated 5V relay, SEN0244 uses a measured 30-second warm-up and fresh 30-sample window, and the actuator-locked Stage 1 firmware powers the probe OFF after each publish attempt. Auto Dosing remains OFF.

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
| 23 | Phase 21 Fix Round 1 audit remediation | Done | Stability contract, post-mixing timestamp/set guard, atomic run/Pump B claims, transactional lifecycle with checked fallback, migration classification, tests, and docs updated. Runtime was unverified at that historical checkpoint and was subsequently exercised by Phase 22B. |
| 24 | Phase 21 Fix Round 2 cleanup and migration audit hardening | Implemented | Superseded artifacts removed, Phase 20 snapshots archived with warnings, README contradiction fixed, and migration completeness validation/tests expanded. Final verification and review package are recorded below. |
| 25 | Phase 22A firmware compile and Telemetry Identity V2 | Done | Baseline and final compile passed with the verified Arduino IDE toolchain. It was not uploaded during Phase 22A; the later physical Stage 1 upload/runtime passed in task 33. |
| 26 | Phase 22A duplicate/order/boot protection | Implemented | V2 validation, partial unique identity index, idempotent duplicate path, conservative boot transition, accepted-only latest, and distinct stability implemented. |
| 27 | Phase 22A Shadow Mode | Done | Pure 30-gate engine, one decision per accepted measurement, read-only APIs, dashboard status/history, and zero-side-effect tests passed in isolated staging and with physical USB telemetry. No pump command or dosing run was created. |
| 28 | Phase 22A Fix 2 independent re-audit | Done | Expired `PROCESSING` lease claim is now atomic by state, lease, and attempt. Full suite: 173 passed, 0 failed, 0 skipped. Full Arduino compile passed; no upload. |
| 29 | Phase 22B Stage 0 isolated staging | Done | Real isolated MongoDB/MQTT/backend/Dashboard runtime PASS on ports 27018/18884/3100. Stop/reset/start repeatability PASS; Auto Dosing OFF, zero pump command, zero dosing run. |
| 30 | Phase 22B Stage 1 Preflight | Done | LAN MQTT/auth/ACL, topic parity, actuator lock, lifecycle, runtime integration, regression, and full profile compile passed. |
| 31 | Source Consolidation and Workspace Cleanup | Done | Main Git history preserved; accepted changes merged by verified diff; 181 tests and 47 syntax checks passed; Stage 1 firmware profile compiled; six redundant trees and generated artifacts were removed. |
| 32 | HydroFlow Local React/Vite UI integration | Done | Express SPA serving, real health/snapshot/sensor-log/calibration adapters, fail-closed capability contract, Windows launchers, responsive UI, acceptance tests, local runtime, and physical ESP32 data display passed. |
| 33 | Phase 22B Stage 1 Physical USB telemetry | Done | USB Stage 1 profile uploaded on COM5. ESP32 joined isolated staging, authenticated to MQTT, and published real V2 telemetry. Pump Main/A/B remained OFF; Auto Dosing OFF; zero pump commands, dosing runs, and pump logs. |
| 34 | Missing TDS value dashboard diagnostics | Done | Confirmed sensor input ADC 2536 / 2.044 V with a stable 30-sample window. Frontend now shows raw ADC/voltage and an explicit missing-calibration message instead of a blank, zero-converted null, or retained design value. |
| 35 | Phase 22B EC/TDS calibration set | Done | Three stable monotonic points saved and validated: 796 µS/cm / 398 ppm, 1340 µS/cm / 670 ppm, and 1670 µS/cm / 835 ppm. Operator explicitly approved activation; the set is now active while Auto Dosing remains OFF. |
| 36 | Active calibration runtime comparison | Done | Runtime TDS is 670.27 ppm versus handheld 673 ppm. The active EC-first set remains in range and the error is about -0.4%. |
| 37 | Phase 22B TDS robust-window stability fix | Done | Firmware trims 3 ADC samples per side for stability only, requires robust spread <= 50 and absolute spread <= 80. Backend independently validates the complete contract and tolerates only the existing verified 5-second uptime-anchor future skew. Regression 198/198, USB Stage 1 compile/upload, and five consecutive physical runtime samples passed with `tdsStable=true` and `tdsControlValid=true`. |
| 38 | Phase 22B 30-minute read-only telemetry soak | Done | Clean rerun PASS: 60 contiguous samples (`seq 88-147`), one boot, max interval 30.105 s, all stable/control-valid, TDS 664.79 ppm average with 0.90 ppm standard deviation, water normal, pumps OFF, and zero command/run/log activity. |
| 39 | Phase 22B Stage 2 main-pump safety preflight | Done | Read-only software preflight PASS and regression 200/200. Its physical gate was subsequently completed by task 40. |
| 40 | Phase 22B Stage 2 bounded Main Pump physical test | Done | Regression 207/207. Four forbidden commands rejected, then one single-use 1000 ms Main Pump pulse produced `started/completed`; operator confirmed normal physical run/stop. Two matching execution logs, zero dosing runs. Operator ACL removed, 12 V disconnected, and profile 1 restore compile/upload/Serial lock verification passed. |
| 41 | Phase 22B post-restore TDS recovery observation | Done with monitoring caveat | Read-only checker implemented. Final corrected 5-minute run passed 10/10 contiguous stable/control-valid samples at 688.10-711.87 ppm. One earlier single-measurement stability rejection recovered on the next payload. Regression 209/209; zero pump commands and zero dosing runs; Auto Dosing OFF and all pumps OFF. |
| 42 | Phase 22B extended TDS and connectivity observation | Superseded | The historical drift/control-invalid result led to the wiring review and probe cleaning in tasks 43-44. It is retained as fault evidence and is no longer the current phase blocker. |
| 43 | SEN0244 power-document correction and physical cause identification | Done | Confirmed project wiring `VCC -> ESP32 5V`, `AOUT -> GPIO34`; official board input 3.3-5.5V and AOUT 0-2.3V. Corrected stale 3V3 checklist. Operator cleaned deposits and removed trapped bubbles; post-clean runtime is tracked separately. |
| 44 | SEN0244 post-clean prototype revalidation | Accepted by operator | Sustained drift resolved. First 15-minute run settled to 14 consecutive valid samples; second run had 29/30 valid with one isolated rejected ADC window followed by six valid samples. Operator accepted this section for prototype progression; TDS remains an Auto Dosing advisory when invalid. |
| 45 | Phase 22B Stage 3 Pump A/B clean-water software preflight | Done (software only) | Profile 3 permits only mutually exclusive A/B MQTT pulses capped at 1000 ms; Main/spare/Serial/set locked. Read-only preflight, compile, regression 213/213, and syntax 55/55 passed. No upload or physical rerun was performed. Prior T07/T08, MQTT Pump Command, Pump Calibration, and clean-water sequential A/B tests remain the accepted physical evidence. |
| 46 | Phase 22B closure and source baseline | Done | Current docs reconciled. Backend 213/213, frontend unit 5/5, Playwright 24/24, JavaScript syntax 56/56, diff check, secret/path checks, and a fresh USB_STAGE1 firmware compile passed. Git checkpoint recorded in `CODEX_PHASE22B_FINAL_REPORT.md`. |
| 47 | Phase 23A Demo and Operational Readiness | Done | Backend 218/218, frontend unit 6/6, Playwright 26/26, PowerShell 3/3, real isolated Stage 0 backup/restore/readiness PASS. Restored evidence: 9 sensor logs, 7 Shadow decisions, zero pump logs/runs, Auto Dosing enabled count zero. |
| 48 | Phase 23B Stage 1 network transition | Done | Distant-AP WPA timeout was diagnosed without weakening safety. Nonblocking retry hardening, auth/ACL/topic parity, backend 219/219, clean compile, COM5 upload, nearby-hotspot Wi-Fi/MQTT, boot transition, three accepted measurements, fresh Dashboard, and zero actuator side effects passed. |
| 49 | Phase 23C React Auto Dosing monitoring | Implemented | GET-only adapter and five-second read-only display for settings, readiness, daily usage, active/latest runs, events, and nutrient response. Runtime browser verification is recorded in the Phase 23C report. |
| 50 | T09/T10 EC relay and settling validation | Done | GPIO32 relay, 10k pull-down, 4.57 V ON / 53.9 mV OFF, AOUT 0 V while OFF, bounded relay windows, and three T10 cycles passed. |
| 51 | Phase 23D EC probe duty-cycle firmware | Implemented and physically exercised | 30 s warm-up, fresh 30-sample window, 35 s watchdog, 60 s minimum OFF, 15 min schedule, retry identity, backend metadata, and no-immediate-retrigger fix. Full 15-minute schedule and forced watchdog timeout remain unverified. |

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

Phase 22B TDS Stability Fix created:

- `03_Edge_Server/mqtt_backend/staging/stage1/Restart-Stage1-Backend.ps1`
- `03_Edge_Server/mqtt_backend/staging/stage1/Run-Stage1-TelemetrySoak.ps1`
- `CODEX_PHASE22B_TDS_STABILITY_FIX_FINAL_REPORT.md`

Phase 22B Stage 2 Safety Preflight created:

- `03_Edge_Server/mqtt_backend/staging/stage1/checkStage2ActuatorReadiness.js`
- `00_Docs/PHASE22B_STAGE2_MAIN_PUMP_SAFETY_PLAN.md`
- `CODEX_PHASE22B_STAGE2_PREFLIGHT_REPORT.md`
- `03_Edge_Server/mqtt_backend/staging/stage1/Prepare-Stage2-MainPumpRuntime.ps1`
- `03_Edge_Server/mqtt_backend/staging/stage1/Verify-Stage2-Firmware.ps1`
- `03_Edge_Server/mqtt_backend/staging/stage1/Arm-Stage2-MainPumpPulse.ps1`
- `03_Edge_Server/mqtt_backend/staging/stage1/runStage2MainPumpPulse.js`
- `03_Edge_Server/mqtt_backend/staging/stage1/runStage2RejectedCommandChecks.js`
- `03_Edge_Server/mqtt_backend/staging/stage1/Disable-Stage2-MainPumpRuntime.ps1`
- `03_Edge_Server/mqtt_backend/staging/stage1/Verify-Stage1-Restore.ps1`
- `03_Edge_Server/mqtt_backend/test/fixtures/stage2_main_pump_lock_host_test.cpp`

Phase 22B post-restore TDS recovery created:

- `03_Edge_Server/mqtt_backend/staging/stage1/Run-Stage1-TdsRecoveryCheck.ps1`
- `CODEX_PHASE22B_TDS_RECOVERY_REPORT.md`

Phase 22B Stage 3 Pump A/B preflight created:

- `03_Edge_Server/mqtt_backend/staging/stage1/checkStage3NutrientPumpReadiness.js`
- `03_Edge_Server/mqtt_backend/test/fixtures/stage3_nutrient_pump_lock_host_test.cpp`
- `00_Docs/PHASE22B_STAGE3_NUTRIENT_PUMP_SAFETY_PLAN.md`
- `CODEX_PHASE22B_STAGE3_PREFLIGHT_REPORT.md`

Source Consolidation created:

- `00_Docs/Phase_Reports/`
- `00_Docs/Patches/`
- `00_Docs/Manifests/`

## 6. Modified Files

Phase 22B TDS Stability Fix:

- Firmware `Config.h`, `Sensors.h/.cpp`, and `PayloadBuilder.cpp`: robust 30-sample ADC window and telemetry fields.
- Backend TDS quality config, validator, quality service, and sensor persistence: independently validate and store the robust contract.
- Backend TDS, stability, and telemetry tests: cover bounded outliers, hard caps, forged relationships, payload budget, and legacy fail-closed behavior.
- Root/backend/staging README files and `00_Docs/Payload_Format.md`: document the current contract and safe backend restart command.
- `00_Docs/PROJECT_STATUS_REPORT.md`: record compile, upload, physical runtime, and safety evidence.
- Stage 1 soak runner and README: prevent Windows standby and document a repeatable read-only 30-minute validation.
- `CODEX_PHASE22B_TDS_STABILITY_FIX_FINAL_REPORT.md`: add complete soak command, statistics, safety counters, and remaining limits.

Phase 22B Stage 2 Safety Preflight:

- `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js`: prove the readiness checker is isolated, read-only, fail-closed, and cannot open the physical gate.
- `00_Docs/PROJECT_STATUS_REPORT.md`: record the passed software gate and pending physical confirmation.
- Firmware `BuildProfile.h`, `ActuatorSafety.h`, `Config.h`, `MqttService.cpp`, `Pumps.cpp`, and `Hydroponic_Device001.ino`: add the bounded Stage 2 Main Pump-only profile without weakening Stage 1 or operational topic identity.
- `03_Edge_Server/mqtt_backend/staging/stage1/Start-Stage1-Preflight.ps1`: create a runtime-only dormant operator credential; default Stage 1 ACL still grants it no command permission.
- `03_Edge_Server/mqtt_backend/staging/stage1/README.md`: document prepare, verify, arm, one-shot, and restore flow.
- `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js`: native/source tests for Stage 1 preservation, Stage 2 GPIO policy, runtime ACL, arm token, and fixed one-shot command.

Phase 22B post-restore TDS recovery:

- `03_Edge_Server/mqtt_backend/staging/stage1/README.md`: document the repeatable read-only recovery command and pass gates.
- `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js`: prove the recovery script is read-only and fail-closed across telemetry, calibration, water, actuator, and dosing gates.
- `CODEX_PHASE22B_STAGE2_PREFLIGHT_REPORT.md`: append post-restore TDS runtime evidence.
- `00_Docs/PROJECT_STATUS_REPORT.md`: replace the stale null-TDS advisory with the measured recovery and transient caveat.
- `00_Docs/Pin_Map.md`: record the verified SEN0244 5V project supply, 0-2.3V AOUT boundary, and fouling/bubble warning.
- `00_Docs/Wiring_Checklist.md`: replace stale TDS 3V3 wiring with 5V and add probe-cleaning, bubble, placement, and control-valid checks.

Phase 22B Stage 3 Pump A/B preflight:

- Firmware `BuildProfile.h`, `Config.h`, `MqttService.cpp`, and `Hydroponic_Device001.ino`: add the isolated Pump A/B-only profile and 1000 ms hard cap while preserving Stage 1/2/operational profiles.
- `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js`: native/source/read-only tests for Stage 3 profile and physical plan.
- `03_Edge_Server/mqtt_backend/staging/stage1/README.md`: document Stage 3 software gate and physical isolation boundary.
- `00_Docs/PROJECT_STATUS_REPORT.md`: record compile, regression, readiness, and closed physical gate.

Phase 22B Stage 1 Physical USB:

- `03_Edge_Server/mqtt_backend/staging/runStage0Checks.js`: accept the HydroFlow SPA identity and inspect loaded dashboard assets for Auto Dosing text.
- `03_Edge_Server/mqtt_backend/staging/stage1/Start-Stage1-Preflight.ps1`: write generated firmware staging secrets as UTF-8 without BOM so Unicode SSIDs are preserved.
- `00_Docs/PROJECT_STATUS_REPORT.md`: record physical USB results and remaining limits.
- `CODEX_PHASE22B_STAGE1_FINAL_REPORT.md`: consolidated secret-safe handoff evidence.
- `03_Edge_Server/frontend/src/adapters/types.ts`: add raw TDS and calibration quality fields to the device snapshot contract.
- `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.ts`: preserve null calibrated values and map raw diagnostics.
- `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.test.ts`: verify null ppm/EC, raw diagnostic mapping, and the backend string contract for scale `"500"`.
- `03_Edge_Server/frontend/src/App.tsx`: display uncalibrated state, ADC, voltage, and remove retained design-value fallback from runtime views.

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
- Auto Dosing monitoring: the legacy dashboard and React dashboard display backend safety state, settings, active/latest run, daily usage, event history, and nutrient response. The React path is GET-only and refreshes every five seconds.
- EC probe duty-cycle protection: active in uploaded `USB_STAGE1` firmware through the validated GPIO32 relay. The active calibration is not yet revalidated for the duty-cycle protocol.
- Auto Dosing events: stored in `auto_dosing_events`; settings and run transitions are logged, while repeated skip reasons are deduplicated for 5 minutes by default.
- Daily usage: calculated from local day start or the latest same-day `manual_daily_reset` event.
- Daily reset: prototype-only, requires exact `RESET DAILY DOSE`, does not delete `dosing_runs`, and does not modify `pump_logs`.
- Dosing run history: V1 legacy and V2 closed-loop runs remain visible and filterable.
- CSV export: available for `dosing_runs`, `nutrient_response_tests`, and `auto_dosing_events`.
- Settings guardrails: mixing delay minimum 60000 ms, step <= per-run maximum, per-run maximum <= daily maximum, enable confirmation, testing delay warning, and disabled presets.
- Hybrid Local-first alignment: dosing logic runs locally on the Hydroponic Edge AI Gateway / Local Control Server represented by the local Node.js backend + MQTT broker + dashboard.
- MongoDB remains in use for this prototype.
- Phase 22B USB Stage 1: firmware profile `USB_STAGE1` is physically uploaded and publishes authenticated telemetry to isolated staging topic `stage1/hydroponic/device001/sensor`.
- Phase 22B actuator state: firmware reports command subscription disabled and actuator lock ON; persisted Pump Main/A/B states are all false.
- Phase 22B pre-Stage-2 safety baseline: Auto Dosing false, observed pump commands 0, `dosing_runs` 0, and `pump_logs` 0 before actuator testing.
- Phase 22B 30-minute soak: 60 contiguous accepted measurements from one boot; all windows stable/control-valid, max interval 30.105 s, no reconnect, TDS average 664.79 ppm with 0.90 ppm standard deviation.
- Phase 22B Stage 2 preflight: `READY_FOR_OPERATOR_PHYSICAL_CONFIRMATION`; `physicalGateOpen=false`, no firmware upload, no MQTT publish, and no database write.
- Phase 22B Stage 2 profile validation: `USB_STAGE2_MAIN_PUMP` was uploaded for the bounded test. Main Pump accepted pulse only with a 3000 ms hard cap; A/B/spare, Serial actuator ON, and continuous set stayed locked. Four negative commands were rejected before the one authorized pulse.
- Phase 22B Stage 2 physical result: one 1000 ms Main Pump pulse completed and was observed physically; runtime command permission and arm token were removed immediately afterward. Final firmware is `USB_STAGE1` with all pumps locked OFF and no command subscription.
- Phase 22B post-restore TDS: active-set calibrated values recovered. The final corrected 5-minute check passed 10/10 samples at 688.10-711.87 ppm with all samples stable/control-valid/in-range. One earlier transient was rejected fail-closed and recovered on the next payload.
- Phase 22B extended observation: one stale-start/new-boot event exposed a checker gap, now fixed with initial freshness, explicit boot-transition, and MQTT reconnect gates. The corrected 15-minute run then failed on sustained ADC/TDS drift despite stable individual firmware windows.

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

### Phase 22B Closure Verification

| Check | Result | Notes |
|---|---|---|
| Backend regression | PASS | `npm test`: 213 passed, 0 failed, 0 skipped. |
| Frontend verification | PASS | ESLint, TypeScript, 5 unit tests, and production build passed. |
| Browser acceptance | PASS | Playwright: 24 passed, 0 failed. |
| JavaScript syntax | PASS | 56 files passed `node --check`. |
| Firmware compile | PASS | `USB_STAGE1`: flash 939020 bytes (71%), static RAM 47240 bytes (14%), no upload. |
| Diff check | PASS | `git diff --check` exit 0; Windows line-ending warnings only. |
| Secret/path checks | PASS | No runtime `.env`, `Secrets.h`, credential file, archive, dependency tree, or build output is included. Known Wi-Fi password occurrence count is zero. |
| Runtime side effects | NONE | No service start, database write, MQTT publish, firmware upload, Auto Dosing action, or pump operation occurred during closure. |

### Phase 23A Verification

| Check | Result | Notes |
|---|---|---|
| Backend regression | PASS | 218 passed, 0 failed, 0 skipped. |
| Frontend verification | PASS | ESLint, TypeScript, 6 unit tests, and production build passed. |
| Browser acceptance | PASS | 26 passed, including stale display, stale-snapshot actuator lock even when capability is open, and outage-to-auto-recovery after the five-second refresh. |
| PowerShell parse | PASS | Launcher, backup, and restore scripts parsed with zero errors. |
| Stage 0 clean lifecycle | PASS | Reset/start, Telemetry Identity/Shadow check, backup, non-empty restore rejection, empty restore, readiness, and stop passed. |
| Restored safety counts | PASS | 9 sensor logs, 7 Shadow decisions, 0 pump logs, 0 dosing runs, 0 enabled Auto Dosing settings. |
| Isolation | PASS | Only `127.0.0.1:27018/18884/3100` was used for Phase 23A runtime. Stage 1 remained healthy and unchanged. |
| Firmware/hardware | NOT RUN | No firmware source change, compile/upload requirement, 12V operation, or pump action in Phase 23A. |

### Phase 23B Network Transition Verification

| Check | Result | Notes |
|---|---|---|
| LAN staging bind/auth/ACL | PASS | Exact private LAN bind plus loopback; authentication required; no wildcard listener; device pump-command delivery denied. |
| Topic and actuator-lock preflight | PASS | Stage 1 topics match; MQTT subscription, Serial commands, local actuation, and all pump GPIO outputs remain locked. |
| Wi-Fi retry hardening | PASS (source) | One `WiFi.begin()` per attempt, 30-second handshake window, nonblocking one-second STA settle, disconnect reason diagnostics. |
| Backend regression | PASS | 219 passed, 0 failed, 0 skipped. |
| Firmware compile | PASS | `USB_STAGE1`: flash 939976 bytes (71%), static RAM 47240 bytes (14%). |
| Distant AP runtime | NOT ACCEPTED | ESP32 reached association but WPA 4-way/handshake timed out (ESP-IDF reasons 15/204). No MQTT client or telemetry was accepted. |
| Final previous-hotspot runtime | PASS | ESP32 joined the nearby hotspot, received `172.20.10.12`, authenticated to MQTT, and published V2 telemetry to `172.20.10.2:18885`. |
| Boot transition and distinct telemetry | PASS | First packet was fail-closed as unconfirmed; seq 2-4 were accepted from one physical boot with 30-second spacing. |
| Dashboard runtime | PASS | Real browser reported `connected-fresh`; Overview/Pumps actuator locks were visible, three pump buttons disabled, and Auto Dosing switch disabled. |
| Actuator side effects | NONE | Physical boot produced at least five sensor logs, zero MQTT pump-command lines after connection, zero `pump_logs`, zero `dosing_runs`, and zero enabled Auto Dosing settings. |
| TDS control state | FAIL-CLOSED AS EXPECTED | Physical voltage was above the synthetic Stage 1 fixture calibration range, so TDS control output stayed null. No calibration was activated or modified. |

- Auto Dosing V2 is rule-based closed-loop step dosing, not Adaptive Dosing.
- Daily reset changes only the software calculation window and cannot remove nutrient physically added to the reservoir.
- Event logging is monitoring-only; failures are warned without interrupting the working dosing sequence.
- Phase 22A/22B firmware compile and physical USB Stage 1 runtime passed. The final ESP32 state was verified as the actuator-locked `USB_STAGE1` profile after the Stage 2 Main Pump test.
- MongoDB transaction behavior and unique partial indexes are tested with a fake repository but not verified on the operational MongoDB topology/data.
- Operational migration dry-run has not run because it would connect to the database.
- Migration completeness is tested with fake rows only; it has not been compared with a sanitized copy of operational calibration data.
- Phase 22A adds firmware `measurementId`/sequence and requires three distinct accepted V2 measurements; duplicate, legacy, out-of-order, old-boot, and unconfirmed-boot rows do not count.
- The robust-window thresholds passed a continuous 30-minute test against the current reservoir and ESP32/SEN0244 setup, but still need longer multi-day observation before any autonomous operation.
- Historical post-reset and extended observations detected null/unstable TDS and a sustained ADC drop. The backend correctly failed closed. The operator identified probe deposits and trapped bubbles, then cleaned and stabilized the probe; task 44 supersedes the historical blocker.
- Post-clean runtime no longer shows the sustained ADC collapse. Strict revalidation is still partial because one isolated 30-sample firmware window had full/robust spread 269/221 despite 29/30 control-valid measurements in the second run.
- SEN0244 VCC is intentionally connected to ESP32 5V in the current project. AOUT, not VCC, connects to GPIO34 and must remain within the module's 0-2.3V output specification.
- Stage 3 is software-prepared and compiled but intentionally not uploaded. It is retained as an optional bounded diagnostic profile, not as an unfinished requirement. Pump A/B physical behavior is supported by the earlier passed T07/T08, MQTT pulse, calibration, and clean-water sequential dosing tests.
- One ESP32 boot change and one backend MQTT reconnect were observed during earlier diagnostics. Subsequent physical telemetry and Dashboard operation passed, but hotspot continuity is not qualified for unattended production use.
- Historical TDS calibration rows remain legacy and are not valid for automatic control; the explicit active set is authoritative.
- No calibration set was created, modified, retired, or activated during the recovery observation.
- The two ordered Hanna HI70031 packets have no measurement result and represent only one distinct EC reference.
- Auto Dosing does not auto-start the main pump in this phase.
- Handheld TDS meters still differ in absolute readings.
- The TDS sensor can be affected by bubbles, probe cleanliness, and mixing state.
- SEN0244 duty cycling uses the reviewed prototype relay on official GPIO32. A solid-state high-side switch remains preferable for a production revision.
- Auto Dosing has only been validated for conservative small-step dosing under supervision, not fully autonomous long-term cultivation.
- pH remains `null`.
- No authentication yet.
- Phase 23B tested a distant replacement AP through the ignored Stage 1 runtime secret. Its WPA handshake timed out, so the accepted runtime returned to the nearer previous hotspot and passed. No Wi-Fi credential is tracked or reported.
- The isolated Stage 1 database uses a synthetic calibration fixture whose voltage range does not include the physical 2.261 V reading. Backend fail-closed behavior is correct; do not infer, migrate, or activate a calibration set from this fixture.
- No SQLite/PostgreSQL migration.
- Cloud/Fleet Management remains architectural only.
- No Device Enrollment, AI Model OTA, Zalo OA, or AI Camera.
- Stage 0 is loopback-only and intentionally anonymous; it is not a production security configuration.
- `npm audit` still reports indirect `body-parser` (low) and `ip-address` (high) findings; no dependency was automatically upgraded in Stage 0.
- Physical USB Stage 1 robust telemetry is verified with `waterLevel=normal`, active EC/TDS calibration, three distinct stable measurements, and explicit control-valid status.
- Set `tds_set_1786679483159_b8f307f8` remains active. The final recovery check measured 688.10-711.87 ppm with 10/10 samples control-valid. Auto Dosing remains OFF; Pump Main/A/B are OFF; `dosing_runs` remains zero. Six Stage 2 audit/execution rows remain intentionally retained in `pump_logs`.
- `D:\Hydroponic_IoT_ESP32.rar` was not deleted because it was not one of the exact authorized cleanup targets and was not used as source.
- Four Phase 21/22 artifacts remain under `D:\Download` because that directory is outside the authorized project cleanup scope; retained in-source copies have matching hashes where applicable.

## 12. Next Recommended Direction

"Observe one complete 15-minute scheduled EC cycle with the probe untouched, then create and validate a new three-point EC-first calibration set using the same 30-second duty-cycle protocol. Keep Auto Dosing OFF and all pump power disconnected."

### Phase 23C Handoff

#### Created Files

- `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md`: hardware-gated, fail-closed probe protection design.
- `CODEX_PHASE23C_FINAL_REPORT.md`: implementation, verification, safety, and remaining-gate report.

#### Modified Files

- `03_Edge_Server/frontend/src/adapters/types.ts`: Auto Dosing monitoring contracts.
- `03_Edge_Server/frontend/src/adapters/index.ts`: export the new contracts.
- `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.ts`: aggregate eight read-only Backend endpoints.
- `03_Edge_Server/frontend/src/App.tsx`: replace placeholder Auto Dosing values with runtime monitoring.
- `03_Edge_Server/frontend/src/styles.css`: responsive run/event monitoring lists.
- `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.test.ts`: GET-only contract coverage.
- `03_Edge_Server/frontend/tests/playwright/frontend-acceptance.spec.ts`: locked read-only runtime rendering coverage.
- `README.md`, `README_HYDROFLOW_LOCAL.md`, and `00_Docs/PROJECT_PLAN.md`: Phase 23C scope and probe protection gate.
- `00_Docs/PROJECT_STATUS_REPORT.md`: current source-of-record status.

#### Safety Confirmation

- No ESP32 firmware file was modified or uploaded.
- No MQTT publisher, pump route, Auto Dosing settings-write route, or enable control was added.
- No calibration lifecycle action was performed.
- No official pin-map change was made.
- Auto Dosing remains OFF and the Stage 1 actuator lock remains authoritative.

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

## 18. HydroFlow Local UI Integration

### Implemented

- Added the React 19, TypeScript, Vite, Lucide, Vitest, and Playwright frontend under
  `03_Edge_Server/frontend/`.
- Express now serves API routes first, the built React SPA second, and preserves the legacy
  public dashboard as fallback when no React build exists. Unknown `/api/*` routes remain 404.
- Added `GET /api/system/capabilities`. Its default is fail-closed: actuator controls stay
  disabled unless build metadata is explicitly verified and both pump locks are deliberately
  removed server-side. Query parameters cannot unlock the UI.
- Connected real Backend health, `device001` latest snapshot, the latest 100 sensor logs,
  EC/TDS calibration-set workflow, supported CSV exports, and capability-gated manual pump APIs.
- Removed fabricated runtime claims from sensor, pump, dosing, database, Cloud, and system
  resource views. Unsupported areas are marked as read-only, browser-local, or not integrated.
- Removed the ZIP's frontend mock-actuator fixture path. Browser controls now have only the real
  Backend API path, protected by fail-closed capability metadata and existing Backend locks.
- Auto Dosing remains OFF and has no enable or settings-write path in the React UI. AI and Cloud
  have no service call, credential, MQTT publisher, or actuator path.

### Created Files

- `03_Edge_Server/frontend/`: complete React/Vite application, adapters, calibration wizard,
  styles, unit test, Playwright acceptance suite, package lock, and tool configuration.
- `03_Edge_Server/mqtt_backend/src/services/systemCapabilityService.js`: fail-closed capability
  metadata builder.
- `03_Edge_Server/mqtt_backend/test/systemCapabilities.test.js`: capability lock regression.
- `03_Edge_Server/mqtt_backend/test/frontendIntegration.test.js`: SPA/API routing regression.
- `03_Edge_Server/mqtt_backend/testSupport/startFrontendAcceptanceServer.js`: isolated browser
  acceptance server; no operational MongoDB or MQTT.
- `README_HYDROFLOW_LOCAL.md`: Windows startup, integration scope, and safety guide.
- `START_FRONTEND_ONLY.bat`: frontend-only launcher.
- `START_FULL_LOCAL.bat`: frontend build plus integrated Backend launcher.
- `START_FULL_LOCAL.ps1`: Windows preflight and safe full-local runtime launcher.

### Modified Files

- `.gitignore`: frontend build/test/cache exclusions.
- `README.md`: current HydroFlow integration status and startup commands.
- `00_Docs/PROJECT_STATUS_REPORT.md`: this handoff entry.
- `03_Edge_Server/mqtt_backend/.env.example`: locked capability metadata examples.
- `03_Edge_Server/mqtt_backend/README.md`: React SPA/API integration and safety contract.
- `03_Edge_Server/mqtt_backend/package.json`: frontend install/build/test commands.
- `03_Edge_Server/mqtt_backend/src/httpServer.js`: reusable Express app plus SPA serving.
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`: read-only capability endpoint.
- `START_FULL_LOCAL.bat`: delegates to the preflight launcher and preserves clear error output.

### Verification

- Frontend `npm run verify`: PASS. ESLint PASS, TypeScript PASS, 3 unit tests passed, production
  build passed with 1,584 modules transformed.
- Frontend `npm run test:e2e`: PASS, 24 passed and 0 failed. Coverage includes 14 direct
  deep-link/reload routes, fail-closed controls, query unlock rejection, Auto Dosing OFF,
  calibration empty state, navigation, SPA/API fallback, and six responsive viewports without
  horizontal document overflow.
- Playwright Chromium revision 1234 was installed after the first browser run was blocked by a
  missing executable. The rerun passed 24/24.
- Backend `npm test`: PASS, 186 passed, 0 failed, 0 skipped.
- Backend `node --check`: PASS for 50 JavaScript files.
- `git diff --check`: PASS; only the repository's expected LF-to-CRLF conversion warnings were
  reported on Windows.
- Full-local launcher runtime: PASS on 2026-08-13. The repaired frontend dependencies built,
  `/overview` returned HTTP 200, and `/health` reported MongoDB and MQTT connected. Capability
  evidence was `LOCAL_UI_SAFE`, actuator locked, pump commands disabled, and Auto Dosing enable
  unavailable. The verification Backend process was stopped afterward.

### Runtime And Safety Status

- Operational MongoDB/MQTT, ESP32, firmware, and hardware were not used.
- No MQTT message, pump command, dosing run, calibration lifecycle change, or Auto Dosing enable
  action occurred.
- Frontend-only runtime correctly reports Backend disconnected and keeps actuators locked.
- Zone/rack/season edits are browser-local drafts and are not a persisted Backend contract.
- Physical USB Stage 1 read-only telemetry passed on 2026-08-14 with the 12V pump supply and nutrient lines disconnected.
- The previous Windows launcher could leave an incomplete `node_modules` directory that passed
  its directory-only check and later failed with `tsc is not recognized`. The new preflight
  checks the actual `tsc.cmd`/`vite.cmd` executables and repairs dependencies when needed.

### Next Recommended Task

Run the integrated UI against the isolated Phase 22B staging environment, keep pump power
removed and Auto Dosing OFF, then verify real `device001` sensor logs and calibration-set pages
without changing calibration lifecycle state or issuing actuator commands.

## 19. Phase 23D Handoff

### Created Files And Folders

- `01_ESP32_Test_Sketches/T09_EC_Power_Relay_Test/T09_EC_Power_Relay_Test.ino`: bounded relay electrical test.
- `01_ESP32_Test_Sketches/T10_EC_Power_Settling_Test/T10_EC_Power_Settling_Test.ino`: repeated 30-second ADC settling test.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/EcProbeSchedule.h`: pure schedule guard used by firmware and native host regression.
- `CODEX_PHASE23D_FINAL_REPORT.md`: complete Phase 23D implementation and verification handoff.

### Modified Files

- Firmware `Config.h`, `Sensors.h`, `Sensors.cpp`, `PayloadBuilder.cpp`, and `Hydroponic_Device001.ino`: GPIO32 duty-cycle state machine, bounded timing, metadata, retry-safe publication, and manual maintenance trigger.
- Backend `sensorPayloadValidator.js` and `sensorLogService.js`: optional legacy-compatible duty-cycle validation and persistence.
- Backend `tdsCalibration.test.js`, `phase22TelemetryIdentity.test.js`, and native firmware fixture: fail-closed metadata, GPIO, packet-budget, and no-same-loop-retrigger coverage.
- `Pin_Map.md`, `Wiring_Checklist.md`, `EC_PROBE_DUTY_CYCLE_PLAN.md`, `Payload_Format.md`, `Database_Schema.md`, `PROJECT_PLAN.md`, `PROJECT_STATUS_REPORT.md`, and `README.md`: wiring, contract, status, and limitations.

### Verification And Runtime

- T09: default OFF, two-second bounded pulse, relay click/LED, contact voltage, sensor VCC, and AOUT back-power checks passed.
- T10: three supervised cycles passed. The conservative warm-up is 30 seconds; the last two repeat cycles stayed near raw ADC 2777-2783.
- Main firmware `USB_STAGE1` clean compile: PASS, flash 942400 bytes (71%), static RAM 47296 bytes (14%).
- Backend/native host regression: 221 passed, 0 failed, 0 skipped.
- COM5 upload and hash verification: PASS.
- Runtime startup window, stable ADC summary, publish attempt, physical relay OFF, and 70-second no-retrigger observation: PASS.
- A first integration build exposed an immediate schedule retrigger caused by same-loop unsigned subtraction. The source was fixed, recompiled, reflashed, and the 70-second runtime check plus host regression passed.
- Isolated Stage 1 evidence after testing: Auto Dosing false, Pump Main/A/B false, pump logs 0, dosing runs 0.
- Full 15-minute schedule interval and forced 35-second watchdog timeout: not yet physically verified.
- Latest duty-cycle measurement remained fail-closed for dosing because calibration/stability readiness was not satisfied. No calibration lifecycle action occurred.

### Safety State

- Auto Dosing remains OFF.
- `USB_STAGE1` disables MQTT pump subscription and Serial actuator commands and forces Pump Main/A/B OFF.
- The 12V pump supply remained disconnected throughout Phase 23D.
- No pump command, pump operation, dosing run, or calibration activation occurred.
- Runtime Wi-Fi/MQTT secrets remain in Git-ignored files and are not recorded in tracked reports.
