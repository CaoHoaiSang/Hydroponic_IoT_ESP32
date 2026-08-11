# CODEX SOURCE CONSOLIDATION FINAL REPORT

## 1. Final Conclusion

`CONSOLIDATION_PASS`

The sole source of record is:

```text
D:\Hydroponic_IoT_ESP32
```

Accepted work through Phase 22B Stage 1 Preflight is consolidated in this Git repository.
The six explicitly authorized redundant directories were removed through the Windows Recycle
Bin after source parity, tests, compile, secret hygiene, artifact transfer, and checkpoint gates
passed. A post-cleanup smoke test passed. Physical USB Stage 1 was not started.

## 2. Scope And Requirement Status

| Requirement | Status | Evidence |
|---|---|---|
| Inventory all seven directories | Complete | `WORKSPACE_PRE_CLEANUP_INVENTORY.csv`, 1040 rows with path, role, size, and SHA-256. |
| Establish directory roles from content | Complete | Git inspection, SHA-256 comparison, and path diff; names/timestamps were not decisive. |
| Preserve main Git history | Complete | Existing repository retained; no nested Git repository remains. |
| Merge Phase 22A Fix 2 | Complete | Commit `739c1f7`, tag `phase22a-fix2-pass`. |
| Merge Phase 22B Stage 0 | Complete | Commit `2141c05`, tag `phase22b-stage0-pass`. |
| Merge Phase 22B Stage 1 Preflight | Complete | Commit `c02e821`, tag `phase22b-stage1-preflight-partial`. |
| Verify latest Stage 1 source parity | Complete | 122 exact matches, 5 explained consolidation changes, 0 missing, 0 unexplained. |
| Preserve reports, patch, and manifests | Complete | Stored below `00_Docs/`; nine transferred artifacts matched SHA-256. |
| Secret/runtime/build hygiene | Complete | No `.env`, `Secrets.h`, generated Stage 1 secret, credentials, runtime, dependency, build, cache, log, or binary output remains in source. |
| Backend regression | Complete | 181 passed, 0 failed, 0 skipped, exit 0. |
| JavaScript syntax | Complete | 47 passed, 0 failed, exit 0. |
| Firmware host tests | Complete | Telemetry and Stage 1 actuator-lock harnesses built and ran, all exit 0. |
| Dashboard DOM/runtime tests | Complete | Included in the 181-test suite and passed. |
| Stage 1 lifecycle/auth/ACL | Complete | Two real isolated cycles passed before cleanup. |
| Full firmware compile, profile 1 | Complete | Exit 0; flash 71%, static RAM 14%. |
| Remove six redundant directories | Complete | All exact target paths now report `False` for existence. |
| Post-cleanup smoke test | Complete | `npm ci`, 181 tests, 47 syntax checks, native host harnesses, JSON parse, Git checks all passed. |
| Physical USB Stage 1 | Not performed | Explicitly paused; no ESP32 connection, upload, or hardware operation. |

## 3. Verified Directory Roles Before Cleanup

| Directory | Verified role |
|---|---|
| `D:\Hydroponic_IoT_ESP32` | Original Git repository and final source of record. |
| `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_ORIGINAL_COMPARE` | Comparison snapshot through Phase 22A Fix 1; no Git metadata. |
| `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT` | Latest pre-consolidation source through Stage 1 Preflight; also contained excluded dependencies/runtime. |
| `D:\Hydroponic_PHASE22A_FIX2_BUILD_20260810` | Phase 22A Fix 2 firmware build output only. |
| `D:\Hydroponic_PHASE22B_STAGE1_BUILD_20260810` | USB Stage 1 firmware build output only. |
| `D:\Hydroponic_STAGE1_PATCH_REPO` | Temporary Git repository used to generate the Stage 1 patch; only commit `2a32628 baseline`. |
| `D:\Hydroponic_STAGE1_PREFLIGHT_BASELINE` | Pre-Stage-1 hash baseline containing Phase 22A Fix 2 plus Stage 0. |

All roots and nested trees were checked for reparse points before deletion. None were found.

## 4. Source Comparison And Provenance

Eligible source comparison excluded `.git`, `node_modules`, runtime, secrets, and build
binaries:

| Comparison | Same | Different | Left only | Right only |
|---|---:|---:|---:|---:|
| Main vs latest re-audit | 68 | 28 | 1 | 31 |
| Fix 1 compare vs latest re-audit | 85 | 15 | 0 | 27 |
| Stage 1 baseline vs latest re-audit | 100 | 11 | 0 | 16 |
| Temporary patch repo vs latest re-audit | 126 | 0 | 0 | 1 patch artifact |

Accepted lineage:

1. Phase 22A Fix 2 changed `sensorLogService.js`, `phase22aFix1.test.js`, and the status report.
2. Phase 22B Stage 0 added the isolated lifecycle, runtime checks, backend publisher/service
   locks, bind-host support, safety tests, and documentation.
3. Phase 22B Stage 1 added the USB build profile, firmware actuator lock, authenticated
   loopback/private-LAN broker, ACL, profile-specific topics, lifecycle checks, host test,
   report, and patch.

`STAGE1_SOURCE_PARITY.csv` compares the latest pre-consolidation Stage 1 source with the main
repository after merge: 127 eligible rows, 122 exact hashes, 5 explained changes, no missing
file, and no unexplained difference. The five intentional consolidation changes are:

- Hardened `.gitignore`.
- Explicit `RESERVED/UNUSED` Alert topic comment in firmware configuration.
- Explicit `RESERVED/UNUSED` Alert note in Stage 1 environment example.
- Explicit `RESERVED/UNUSED` Alert note in Stage 1 README.
- Executable Stage 1 test assertion that the Alert topic is reserved and unused.

No sensor, calibration, payload, dosing sequence, or pump-command behavior was changed by the
consolidation-specific edits.

## 5. Logic Before And After Consolidation

Before consolidation, the original Git repository did not contain one traceable sequence of
all accepted Fix 2, Stage 0, and Stage 1 changes. The newest state was distributed across a
comparison snapshot, baseline, re-audit tree, build trees, and temporary patch repository.
Generated runtime/dependency data and historical handoff artifacts were mixed with source.

After consolidation:

- One Git repository contains the accepted implementation and its history.
- Telemetry Identity V2 retains idempotent retry, boot/order protection, accepted-only latest
  state, and distinct-measurement stability.
- Shadow Mode remains observation-only and has no pump publisher or dosing-run writer.
- Stage 0 remains an isolated repeatable staging profile.
- Stage 1 uses matching `stage1/` topics, authenticated ACL-protected MQTT, and a compile-time
  `USB_STAGE1` firmware profile.
- USB Stage 1 does not subscribe to pump commands; MQTT, Serial, and local actuator paths fail
  closed; Main, A, B, and spare outputs are maintained OFF.
- Backend publisher and pump service locks remain active in staging.
- Auto Dosing remains OFF. The existing Pump A then Pump B then mixing-wait implementation is
  preserved but unreachable through the verified Stage 1 safety profile.
- Reports, patches, and source manifests are documentation inside the source of record, not
  alternative source trees.

## 6. Technical Decisions

- Merge by path-level diff and SHA-256 instead of directory overwrite. This preserves main
  history and prevents runtime or secret files from entering source.
- Keep a separate checkpoint for each accepted phase. This makes Fix 2 PASS, Stage 0 PASS, and
  Stage 1 PARTIAL independently traceable.
- Treat `devices`/MQTT/runtime evidence from isolated staging as evidence, not source data.
- Keep the Stage 1 Alert topic identifier for parity but mark it `RESERVED/UNUSED`; no publish
  or subscribe path was introduced.
- Use a compile-time firmware profile for the hardware lock. A runtime setting cannot bypass
  it accidentally.
- Preserve generated credentials only during staging runtime, under ignored paths, then reset
  and remove them.
- Use Windows Recycle Bin for all authorized redundant directories and duplicate/generated
  project artifacts instead of permanent deletion.
- Do not auto-upgrade dependencies. `npm ci` reported one low and one high indirect advisory;
  dependency impact should be reviewed separately from this safety consolidation.

## 7. Git Checkpoints And Tags

| Commit | Tag | Verified state |
|---|---|---|
| `739c1f7f9eeabf244060db320dcd569d3ba12997` | `phase22a-fix2-pass` | Phase 22A Fix 2, 173 tests and full firmware compile PASS. |
| `2141c050f1ad969d2ffc2802d25a65b200adf4ec` | `phase22b-stage0-pass` | Real isolated Stage 0 runtime PASS. |
| `c02e821ffda27f58352e465eb8d650c62f8d9e60` | `phase22b-stage1-preflight-partial` | Stage 1 preflight PASS except physical Wi-Fi/USB evidence. |
| `f0e337068a0084669cf2e5252228eb82e19a88e6` | `source-consolidation-precleanup` | Provenance and manifests recorded before deletion. |
| Final report commit (`docs: finalize source consolidation cleanup`) | `source-consolidation-pass` | Post-cleanup verification, status update, and this report. |

One checkpoint preparation issue was caught and resolved: the first Fix 2 checkpoint briefly
contained a Stage 0 status report. The exact verified Fix 2 status-report entry was read from
the SHA-verified review archive, the checkpoint was amended, the tag was updated, and the Stage
0 status was restored only in its own checkpoint. No unresolved merge conflict remains.

## 8. Complete Source Change Inventory

The following is the complete path inventory from original main commit `be1e879` through the
pre-cleanup consolidation commit, grouped by purpose. `A`, `M`, and `R` mean added, modified,
and renamed.

### Project, schemas, and documentation

- `M .gitignore`: block credentials, dependencies, runtime, build/cache/log/binary/temp/archive output.
- `M README.md`: Phase 21, Phase 22A, Stage 0, and Stage 1 status and operator guidance.
- `A 00_Docs/DEMO_CHECKLIST_AUTO_DOSING.md`: retained supervised demo checklist.
- `M 00_Docs/Database_Schema.md`: EC/TDS, identity, Shadow, and safety schema contract.
- `A 00_Docs/EC_TDS_Calibration.md`: EC-first calibration guide.
- `A 00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md`: retained pending DOCX update review.
- `M 00_Docs/PROJECT_PLAN.md`: Phase 21 and 22 roadmap/status.
- `M 00_Docs/PROJECT_STATUS_REPORT.md`: cumulative verified phase status.
- `M 00_Docs/Payload_Format.md`: measurement identity and quality payload contract.
- `A 00_Docs/Telemetry_Identity_Shadow_Mode.md`: Identity V2 and Shadow Mode guide.
- `R 00_Docs/PHASE_20B_REVIEW_PACKAGE.md -> 00_Docs/archive/phase20/PHASE_20B_REVIEW_PACKAGE.md`: historical archive.
- `A 00_Docs/archive/phase20/PHASE_20C_REVIEW_PACKAGE.md`: historical archive.
- `A 00_Docs/archive/phase20/PHASE_20D_REVIEW_PACKAGE.md`: historical archive.
- `M 04_Database/mongodb_schema.md`: current MongoDB contract.
- `M 04_Database/sample_payload.json`: current telemetry example.

### Retained reports, patch, and manifests

- `A 00_Docs/Phase_Reports/CODEX_PHASE21_FIX1_FINAL_REPORT.md`
- `A 00_Docs/Phase_Reports/CODEX_PHASE21_FIX2_FINAL_REPORT.md`
- `A 00_Docs/Phase_Reports/CODEX_PHASE22A_FINAL_REPORT.md`
- `A 00_Docs/Phase_Reports/CODEX_PHASE22A_FIX2_FINAL_REPORT.md`
- `A 00_Docs/Phase_Reports/CODEX_PHASE22B_STAGE0_REPORT.md`
- `A 00_Docs/Phase_Reports/CODEX_PHASE22B_STAGE1_PREFLIGHT_REPORT.md`
- `A 00_Docs/Phase_Reports/PHASE21_FIX1_REAUDIT_AND_CLEANUP_PLAN.md`
- `A 00_Docs/Phase_Reports/PHASE21_INDEPENDENT_AUDIT.md`
- `A 00_Docs/Patches/CODEX_PHASE22B_STAGE1_PREFLIGHT.patch`
- `A 00_Docs/Manifests/ARTIFACT_TRANSFER_HASHES.csv`: artifact copy hashes.
- `A 00_Docs/Manifests/SOURCE_PROVENANCE.md`: accepted source lineage.
- `A 00_Docs/Manifests/STAGE1_CHECKPOINT_SOURCE_SHA256.csv`: checkpoint source hashes.
- `A 00_Docs/Manifests/STAGE1_SOURCE_PARITY.csv`: latest-source parity result.
- `A 00_Docs/Manifests/WORKSPACE_PRE_CLEANUP_INVENTORY.csv`: seven-tree inventory.
- `A 00_Docs/Manifests/POST_CLEANUP_VERIFICATION.txt`: final deletion and smoke evidence.
- `A 00_Docs/Phase_Reports/CODEX_SOURCE_CONSOLIDATION_REPORT.md`: this report.

### ESP32 firmware

- `A ActuatorSafety.h`, `A BuildProfile.h`: pure actuator lock and profile selection.
- `M Config.h`: profile-specific MQTT identity/topics; Alert reserved in Stage 1.
- `M Hydroponic_Device001.ino`: telemetry identity plus MQTT/Serial/local actuator guards.
- `M MqttService.cpp`: profile secret selection and conditional command subscription.
- `M PayloadBuilder.cpp`, `M PayloadBuilder.h`: Telemetry Identity V2 payload.
- `M Pumps.cpp`, `M Pumps.h`: fail-closed output enforcement.
- `A SecretsStage1.h.example`: secret-free staging template.
- `M Sensors.cpp`, `M Sensors.h`: Phase 21 nonblocking quality telemetry.
- `A TelemetryIdentity.cpp`, `A TelemetryIdentity.h`: boot/measurement identity.
- `A TelemetryPublishState.h`, `A TelemetrySequence.h`: retry and monotonic sequence state.

All firmware paths above are under
`02_ESP32_Main_Firmware/Hydroponic_Device001/`.

### Backend and dashboard

- `M .env.example`, `M README.md`, `M package.json`: safe configuration, operation, and test scripts.
- `M public/app.js`, `M public/index.html`, `M public/styles.css`: calibration, readiness, identity, Shadow, and monitoring UI.
- `A scripts/migrateLegacyTdsCalibrations.js`: dry-run-default legacy audit command.
- `A src/config/phase22Config.js`, `A src/config/tdsQualityConfig.js`: fixed identity/quality settings.
- `M src/httpServer.js`: optional isolated bind host.
- `M src/mongoClient.js`: indexes and repositories for current data contracts.
- `M src/mqttClient.js`: telemetry pipeline and staging publisher lock.
- `M src/routes/deviceRoutes.js`: current read/write API surface and Shadow read APIs.
- `A src/services/autoDosingEventService.js`: dosing event audit.
- `A src/services/autoDosingReadinessService.js`: fail-closed readiness evaluation.
- `M src/services/autoDosingService.js`: Phase 21 safety and Phase 22 production lock.
- `A src/services/exportService.js`: CSV export services.
- `M src/services/pumpCommandService.js`: environment pump-command service lock.
- `M src/services/sensorLogService.js`: identity-aware idempotent ingestion and lease recovery.
- `A src/services/shadowDosingEngine.js`, `A src/services/shadowDosingService.js`: observation-only decisions/history.
- `M src/services/tdsCalibrationService.js`, `A src/services/tdsQualityService.js`: EC-first set lifecycle and quality state.
- `A src/services/telemetryIdentityService.js`, `A src/services/telemetryPipelineService.js`: identity/order pipeline.
- `M src/validators/autoDosingSettingsValidator.js`, `M src/validators/sensorPayloadValidator.js`.
- `A src/validators/tdsCalibrationSetValidator.js`, `M src/validators/tdsCalibrationValidator.js`.

All backend paths above are under `03_Edge_Server/mqtt_backend/`.

### Isolated staging

- `A staging/.env.staging.example`, `A staging/mosquitto.stage0.conf`.
- `A staging/Stage0.Common.ps1`, `A staging/Start-Staging.ps1`.
- `A staging/Stop-Staging.ps1`, `A staging/Reset-Staging.ps1`.
- `A staging/Get-StagingStatus.ps1`, `A staging/runStage0Checks.js`, `A staging/README.md`.
- `A staging/stage1/.env.stage1.example`, `A staging/stage1/mosquitto.stage1.conf.example`.
- `A staging/stage1/Stage1.Common.ps1`, `A staging/stage1/Start-Stage1-Preflight.ps1`.
- `A staging/stage1/Stop-Stage1-Preflight.ps1`, `A staging/stage1/Reset-Stage1-Preflight.ps1`.
- `A staging/stage1/Get-Stage1-Status.ps1`, `A staging/stage1/runStage1PreflightChecks.js`.
- `A staging/stage1/README.md`.

### Tests and fake repository

- `A test/autoDosingSafety.test.js`, `A test/dashboardContract.test.js`.
- `A test/phase21FixBehavior.test.js`, `A test/stabilityMigration.test.js`.
- `A test/tdsCalibration.test.js`.
- `A test/phase22TelemetryIdentity.test.js`, `A test/phase22ShadowEngine.test.js`.
- `A test/phase22Pipeline.test.js`, `A test/phase22aFix1.test.js`.
- `A test/stage0Safety.test.js`, `A test/stage1PreflightSafety.test.js`.
- `A test/fixtures/telemetry_firmware_host_test.cpp`.
- `A test/fixtures/stage1_actuator_lock_host_test.cpp`.
- `A testSupport/fakeMongo.js`.

All test paths above are under `03_Edge_Server/mqtt_backend/`.

## 9. Test, Runtime, Build, And Migration Evidence

### Final regression before cleanup

```powershell
cd D:\Hydroponic_IoT_ESP32\03_Edge_Server\mqtt_backend
npm test
```

Result: 181 passed, 0 failed, 0 skipped, exit code 0. This includes backend regression,
Dashboard DOM/runtime, migration fixtures, Telemetry Identity, Shadow Mode, firmware host
harness, Stage 0 safety, Stage 1 topic parity, reserved Alert, and actuator lock tests.

### Post-cleanup smoke

```powershell
npm ci --ignore-scripts
npm test
```

Result: dependency install exit 0; test result 181 passed, 0 failed, 0 skipped, exit 0.
The temporary `node_modules` directory was then removed through the Recycle Bin and verified
absent. `npm ci` reported two indirect advisories, one low and one high; no automatic upgrade
or `npm audit fix` was run.

### JavaScript syntax

```powershell
Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Result: 47 checked, 47 passed, 0 failed, exit code 0 before and after cleanup.

### Native firmware smoke

```powershell
g++ -std=c++17 -Wall -Wextra -Werror -I <firmware-dir> telemetry_firmware_host_test.cpp -o <temp-exe>
g++ -std=c++17 -Wall -Wextra -Werror -I <firmware-dir> stage1_actuator_lock_host_test.cpp -o <temp-exe>
```

Result: both builds exit 0; both runs exit 0. Temporary executables were deleted from the OS
temporary directory.

### Stage 0 actual isolated runtime

```powershell
.\Start-Staging.ps1
node .\runStage0Checks.js
.\Stop-Staging.ps1
.\Reset-Staging.ps1
```

Result: two repeatable cycles passed on MongoDB `127.0.0.1:27018`, MQTT
`127.0.0.1:18884`, and backend/dashboard `127.0.0.1:3100`. Sensor logs 9, Shadow decisions
7, distinct stable measurements 3, HTTP 200, Auto Dosing false, pump commands 0, pump logs
0, dosing runs 0. Exit code 0. Production endpoints were not used.

### Stage 1 actual isolated runtime, auth, and ACL

```powershell
.\Start-Stage1-Preflight.ps1
node .\runStage1PreflightChecks.js
.\Get-Stage1-Status.ps1
.\Stop-Stage1-Preflight.ps1
.\Reset-Stage1-Preflight.ps1
```

Result: two lifecycle cycles passed. Actual MQTT listeners were only
`127.0.0.1:18885` and `192.168.1.90:18885`; MongoDB was `127.0.0.1:27019`; backend was
`127.0.0.1:3101`. Anonymous access was rejected. Two unauthorized pump-command publish
attempts were denied. Delivered pump commands 0, pump logs 0, dosing runs 0, production
endpoints accessed 0, Auto Dosing false. Five PowerShell files parsed successfully. Exit 0.

After cleanup there are zero listeners on ports 18884, 18885, 27018, 27019, 3100, and 3101,
and the scoped `Hydroponic Phase22B Stage1 MQTT` firewall rule is absent. A separate generic
`Mosquitto MQTT` inbound rule for port 1883 already exists and was intentionally untouched;
it is not the staging rule and the consolidation did not connect to port 1883.

### Full USB Stage 1 firmware compile

```powershell
arduino-cli compile --clean `
  --fqbn "esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default" `
  --build-property "compiler.cpp.extra_flags=-DHYDROPONIC_BUILD_PROFILE=1" `
  02_ESP32_Main_Firmware\Hydroponic_Device001
```

Toolchain: Arduino CLI 1.5.1, ESP32 core 3.3.10. Result: exit code 0.

- Flash: 938548 / 1310720 bytes, 71%.
- Static RAM: 47208 / 327680 bytes, 14%.
- Remaining dynamic memory: 280472 bytes.

The build output directory was removed after verification. Compile success is not a physical
network or GPIO test. No upload command ran.

### Migration dry-run

The migration fixture dry-run is part of `npm test`: one targeted migration test passed with
zero fake-repository writes. The script remains dry-run by default and requires explicit
`--apply`. No operational MongoDB migration command was run during consolidation because that
would connect to an operational database.

### Additional final checks

- `package.json` parse: PASS.
- `04_Database/sample_payload.json` parse: PASS.
- `git diff --check`: exit 0.
- `git fsck --no-dangling`: exit 0.
- Git untracked files: 0 before final report creation.

## 10. Secret And Production Hygiene

- Existing ignored runtime files `.env` and `Secrets.h` were removed from the source tree
  without printing their contents.
- Generated `.stage0_runtime/`, `.stage1_runtime/`, and `SecretsStage1.h` are absent.
- Source-path scan found no runtime secret filename or credential file.
- Secret-pattern scan found no exposed credential value.
- Example files contain placeholders only and remain intentionally tracked.
- No production MongoDB endpoint, production MQTT broker, production credential, database
  dump, token, or password was copied into source, report, patch, or manifest.
- No service was left running after cleanup.
- No new ZIP or source-copy directory was created.

This report contains endpoint and topic identifiers needed for verification, but no secret.

## 11. Mandatory Stage 1 Safety Evidence

- USB profile and compile-time locks:
  `BuildProfile.h:11-14` selects `USB_STAGE1`, `ACTUATORS_LOCKED=true`, and
  `MQTT_PUMP_COMMANDS_ENABLED=false`.
- Pump command subscription is conditional:
  `MqttService.cpp:82-83`; profile 1 takes the disabled branch.
- MQTT handler rejects actuation:
  `Hydroponic_Device001.ino:525` and `:601-603`.
- Serial actuator commands are rejected:
  `Hydroponic_Device001.ino:633`.
- Local loop maintains lock:
  `Hydroponic_Device001.ino:775` and `Pumps.cpp:70`.
- Backend publisher lock:
  `src/mqttClient.js:9` and `:104`.
- Backend service lock:
  `src/services/pumpCommandService.js:76-77` and `:125-126`.
- Broker anonymous denial and ACL files:
  `staging/stage1/mosquitto.stage1.conf.example:3-7`.
- Generated Stage 1 environment forces `PUMP_COMMANDS_DISABLED=true`:
  `Start-Stage1-Preflight.ps1:95`.
- Alert topic is `RESERVED/UNUSED`; executable regression prevents accidental Stage 1 use.
- Auto Dosing stayed OFF; verified Stage 0 and Stage 1 runs produced zero pump command,
  zero pump log, and zero dosing run.

## 12. Exact Cleanup Performed

The following exact directories were resolved, checked for reparse points, and sent to the
Windows Recycle Bin:

1. `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_ORIGINAL_COMPARE`
2. `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT`
3. `D:\Hydroponic_PHASE22A_FIX2_BUILD_20260810`
4. `D:\Hydroponic_PHASE22B_STAGE1_BUILD_20260810`
5. `D:\Hydroponic_STAGE1_PATCH_REPO`
6. `D:\Hydroponic_STAGE1_PREFLIGHT_BASELINE`
7. `D:\Hydroponic_IoT_ESP32\03_Edge_Server\mqtt_backend\node_modules`

The following duplicate/generated files were sent to the Windows Recycle Bin:

1. `D:\Hydroponic_IoT_ESP32\CODEX_PHASE21_FIX1_FINAL_REPORT.md`
2. `D:\Hydroponic_IoT_ESP32\CODEX_PHASE21_FIX2_FINAL_REPORT.md`
3. `D:\Hydroponic_IoT_ESP32\CODEX_PHASE22A_FINAL_REPORT.md`
4. `D:\Hydroponic_IoT_ESP32\Hydroponic_IoT_ESP32_PHASE21_FIX2_REVIEW.zip`
5. `D:\Hydroponic_IoT_ESP32\Hydroponic_IoT_ESP32_PHASE22A_REVIEW.zip`

The ignored main-tree `.env` and `Secrets.h` were removed with exact path-scoped file edits;
their content was never displayed. Stage lifecycle reset removed generated runtime and staging
secret material before final verification.

All six authorized redundant directory targets now report absent. No wildcard/glob deletion
was used, and the source-of-record directory was never a deletion target.

## 13. Items Not Removed

- `D:\Hydroponic_IoT_ESP32.rar`: not one of the six exact authorized cleanup directories and
  not classified as source during the seven-directory audit. It was left untouched to avoid
  expanding deletion scope based only on a similar name.
- `D:\Download\CODEX_PHASE22A_FIX2_FINAL_REPORT.md`
- `D:\Download\Hydroponic_IoT_ESP32_PHASE22A_FIX2_REVIEW.zip`
- `D:\Download\PHASE21_FIX1_REAUDIT_AND_CLEANUP_PLAN.md`
- `D:\Download\PHASE21_INDEPENDENT_AUDIT.md`

The four `D:\Download` files are outside the authorized project cleanup scope. Required copies
inside the source repository were hash-verified where applicable. None of these external items
is a working tree or is used by the consolidated source.

## 14. Final Workspace State

Within the seven audited source/build locations, only `D:\Hydroponic_IoT_ESP32` exists.
There is no compare, re-audit, build, baseline, patch-repo, or phase working tree. The main
repository has no dependency, runtime, build output, cache, log, compiled binary, temporary
file, runtime secret, or credential artifact.

Condensed final tree:

```text
Hydroponic_IoT_ESP32/
|-- 00_Docs/
|   |-- Manifests/
|   |-- Patches/
|   |-- Phase_Reports/
|   `-- archive/phase20/
|-- 01_ESP32_Test_Sketches/
|-- 02_ESP32_Main_Firmware/Hydroponic_Device001/
|-- 03_Edge_Server/mqtt_backend/
|   |-- public/
|   |-- scripts/
|   |-- src/
|   |-- staging/stage1/
|   |-- test/fixtures/
|   `-- testSupport/
|-- 04_Database/
|-- 05_Calibration_Data/
|-- 99_Backup/old_versions/
|-- .git/
|-- .gitignore
`-- README.md
```

The main Git repository is healthy and checkpoint tags are traceable. The source is ready to
resume the supervised Physical USB Stage 1 procedure, while its current physical verification
status correctly remains `PARTIAL`.

## 15. Risks And Unverified Items

- Physical ESP32 Wi-Fi reachability, firmware upload, GPIO electrical OFF state, and hardware
  behavior remain unverified. This was required to stay out of scope.
- Stage 1 Wi-Fi credentials were unavailable, so the report does not claim
  `READY_FOR_PHYSICAL_USB_STAGE1` from the earlier preflight.
- The LAN broker test ran from the same computer, not a second Wi-Fi device.
- Operational MongoDB migration was not run.
- Two indirect npm advisories remain, one low and one high. No automatic dependency update was
  made; review compatibility and exploit reachability in a separate dependency task.
- `D:\Hydroponic_IoT_ESP32.rar` and four out-of-scope `D:\Download` artifacts remain as listed
  above, but none is an active working tree.

## 16. Next Work In Priority Order

1. Review this consolidation checkpoint and keep Git working tree clean.
2. Prepare dedicated process-only Stage 1 Wi-Fi credentials without committing or reporting
   values.
3. Resume supervised Physical USB Stage 1 with pump power removed, nutrient bottles
   disconnected, and Auto Dosing OFF.
4. Verify startup reports `USB_STAGE1`, command subscription `DISABLED`, and actuator lock ON.
5. With pumps disconnected, verify telemetry reaches the isolated LAN broker and Dashboard.
6. Measure Main/A/B GPIO/output OFF state and repeat unauthorized MQTT/Serial command tests.
7. Assess the two npm advisories separately without an automatic major dependency rewrite.

## 17. Mandatory Confirmations

- No ESP32 was connected.
- No firmware was uploaded.
- No physical sensor, MOSFET, pump, or nutrient bottle was operated.
- No MQTT pump command was successfully published or delivered.
- No dosing run or pump log was created by consolidation.
- Auto Dosing remained OFF.
- No calibration set was activated or retired.
- No production database or broker was accessed.
- No production credential or secret was copied, printed, or committed.
- No new ZIP or alternate source tree was created.
- Pump A then Pump B then mixing-wait logic was preserved.
- Stage 1 Alert remains `RESERVED/UNUSED`.
- Final conclusion: `CONSOLIDATION_PASS`.
