# CODEX PHASE 23D FINAL REPORT

## 1. Scope And Objective

Phase 23D adds bounded power duty cycling for the SEN0244 EC/TDS board. A 5 V relay on
GPIO32 powers the sensor only for a measurement window, reducing continuous electrode
energization, buildup, and drift. The work included electrical validation sketches, settling
tests, integrated firmware, telemetry metadata, backend validation/persistence, regression
coverage, documentation, firmware upload, and a supervised runtime check.

This phase did not change EC/TDS calibration coefficients, activate a calibration set, enable
Auto Dosing, issue a pump command, or operate a pump.

## 2. Requirement Status

| Requirement | Status | Evidence / limitation |
|---|---|---|
| Relay wiring and safe default OFF | Complete, physically verified | T09; relay and SEN0244 LEDs OFF at rest. |
| Relay contact and sensor power voltage | Complete, physically verified | Contact ON 4.55 V; SEN0244 VCC ON 4.57 V, OFF 53.9 mV. |
| AOUT not back-powered while OFF | Complete, physically verified | SEN0244 AOUT measured 0 V while OFF. |
| Determine a conservative warm-up | Complete for prototype use | Three T10 cycles; 30 seconds selected after 10 seconds proved insufficient in the first cycle. |
| Nonblocking duty-cycle firmware | Complete | State machine uses `millis()` and samples only after warm-up. |
| Fresh 30-sample window | Complete | New samples are collected after each 30-second warm-up. |
| Maximum power-on watchdog | Complete in source/tests; not physically forced | 35-second bound implemented; no induced timeout test. |
| Minimum OFF time | Complete | 60-second guard plus same-loop completion guard. |
| Scheduled measurement | Complete in source; partially physically verified | 15-minute interval configured; 70-second no-retrigger passed, full 15-minute wait not yet observed. |
| Manual maintenance trigger | Complete | Serial `measure_ec` requests a bounded measurement; actuator commands remain locked. |
| Retry with relay OFF | Complete | Completed payload/identity remains pending while relay powers OFF after first publish attempt. |
| Backend metadata contract | Complete | Optional legacy-compatible group validation and persistence added. |
| Firmware compile and upload | Complete | Clean USB_STAGE1 compile and COM5 upload/hash verification passed. |
| Integrated startup measurement | Complete, physically verified | One warm-up/sample/publish cycle completed and relay stayed OFF afterward. |
| Auto Dosing and pump safety | Complete, verified in isolated staging | Auto Dosing false, pump logs 0, dosing runs 0; 12 V pump supply disconnected. |
| New three-point duty-cycle calibration | Not done | Must follow the full 15-minute schedule observation. |

## 3. Files Created Or Modified

### Phase 23D files

| File | Change and purpose |
|---|---|
| `01_ESP32_Test_Sketches/T09_EC_Power_Relay_Test/T09_EC_Power_Relay_Test.ino` | Bounded relay pulse and manual contact/power verification. |
| `01_ESP32_Test_Sketches/T10_EC_Power_Settling_Test/T10_EC_Power_Settling_Test.ino` | Three supervised settling cycles with 30-sample statistics. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/EcProbeSchedule.h` | Pure scheduling guard shared with native host regression. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h` | GPIO32 and duty-cycle timing constants. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.h` | EC power state and measurement lifecycle interface. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.cpp` | Relay control, state machine, warm-up, fresh sampling, watchdog, and OFF guards. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino` | Startup/manual/scheduled triggers, publish lifecycle, retry behavior, and status output. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp` | Duty-cycle telemetry identity and state metadata. |
| `03_Edge_Server/mqtt_backend/src/validators/sensorPayloadValidator.js` | Fail-closed validation for a complete duty-cycle metadata group. |
| `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js` | Persist metadata to `sensor_logs` and `devices.latest`. |
| `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js` | Metadata acceptance and incomplete/unpowered rejection tests. |
| `03_Edge_Server/mqtt_backend/test/phase22TelemetryIdentity.test.js` | GPIO32 source contract and 1024-byte packet budget coverage. |
| `03_Edge_Server/mqtt_backend/test/fixtures/telemetry_firmware_host_test.cpp` | Native regression for no immediate same-loop retrigger. |
| `00_Docs/Pin_Map.md` | Official GPIO32 relay and SEN0244 switched-power wiring. |
| `00_Docs/Wiring_Checklist.md` | Power-off checks and measured wiring validation steps. |
| `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md` | Design, measured warm-up, implementation status, and remaining gates. |
| `00_Docs/Payload_Format.md` | Duty-cycle payload fields and semantics. |
| `00_Docs/Database_Schema.md` | Persisted duty-cycle telemetry fields. |
| `00_Docs/PROJECT_PLAN.md` | Phase 23D plan entry. |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Current phase, physical results, safety state, and next task. |
| `README.md` | Current duty-cycle behavior and recalibration warning. |
| `CODEX_PHASE23D_FINAL_REPORT.md` | This consolidated handoff report. |

### Pre-existing Phase 23C working-tree changes preserved

The following changes existed before Phase 23D and were intentionally preserved:
`03_Edge_Server/frontend/src/App.tsx`, adapter source/tests/types, `styles.css`, Playwright
acceptance tests, `README_HYDROFLOW_LOCAL.md`, and `CODEX_PHASE23C_FINAL_REPORT.md`.
They provide the integrated read-only dashboard work and are covered by the frontend test
results below. No unrelated user change was reverted.

## 4. Logic Before And After

Before Phase 23D, the SEN0244 board was continuously powered. Firmware continuously updated
the TDS ADC window and published periodic telemetry. Long powered periods could promote probe
buildup and drift, and a retry had no explicit measurement-power identity.

After Phase 23D, the relay defaults OFF. A startup, scheduled, or manual request powers the
board, waits 30 seconds, clears the ADC window, collects 30 fresh samples at 40 ms intervals,
marks the measurement READY, and attempts one telemetry publication. The relay then powers OFF
regardless of MQTT success. Failed publication retries reuse the same pending payload and
Telemetry Identity V2 sequence while the probe remains OFF. New scheduled acquisition is
blocked while telemetry is pending. A 35-second watchdog and 60-second minimum OFF guard bound
fault behavior.

An integration bug initially allowed an immediate retrigger: `currentMs` captured before
power-off was compared with a later `lastPoweredOffMs`, producing unsigned wraparound. The
schedule decision is now a pure guarded helper, and the main loop refuses scheduling when a
measurement completed in that same iteration.

## 5. Technical Decisions

1. **30-second warm-up:** the first T10 cycle was still drifting after 10 seconds; the second
   and third cycles stabilized near raw ADC 2777-2783 after 30 seconds.
2. **Relay active HIGH on GPIO32:** matches the physically validated HIGH-jumper module and
   avoids changing official sensor/pump pins.
3. **Fresh window after warm-up:** prevents stale OFF/warm-up samples from entering EC/TDS
   conversion or stability checks.
4. **Power OFF after first publish attempt:** network failure cannot leave the probe energized.
5. **Pending-payload retry:** preserves boot ID, sequence, sample time, and measurement metadata,
   maintaining backend idempotency.
6. **Legacy-compatible backend fields:** older continuous-power telemetry remains readable;
   duty-cycle payloads are accepted only when the entire metadata group is coherent.
7. **USB_STAGE1 build profile:** MQTT pump subscription and Serial actuator commands stay
   disabled, with all pumps forced OFF during physical sensor testing.

## 6. Verification Results

### Backend and native regression

Command:

```powershell
cd 03_Edge_Server\mqtt_backend
npm test
```

Result: PASS, exit code `0`; 221 tests passed, 0 failed, 0 skipped. This includes firmware-host,
Telemetry Identity V2, packet-budget, metadata validation, calibration safety, Auto Dosing
fail-closed behavior, and fake-repository migration coverage.

### Frontend verification

Commands:

```powershell
cd 03_Edge_Server\frontend
npm run verify
npm run test:e2e
```

Result: PASS, exit code `0` for both commands. ESLint passed, TypeScript passed, Vitest passed
7/7, production build passed with 1584 modules, and Playwright passed 27/27.

### JavaScript syntax

Command pattern:

```powershell
Get-ChildItem 03_Edge_Server -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch 'node_modules|dist|build' } |
  ForEach-Object { node --check $_.FullName }
```

Result: PASS, exit code `0`; 59/59 JavaScript files passed `node --check`.

### Migration dry-run

Safe isolated command:

```powershell
cd 03_Edge_Server\mqtt_backend
node --test --test-name-pattern="migration dry-run performs no writes" test/stabilityMigration.test.js
```

Result: PASS, exit code `0`; 1 test passed, 0 failed, 0 skipped, and fake-database writes remained
zero. The operational migration script was not run because Phase 23D changes no schema requiring
migration and an operational dry-run would connect to MongoDB. No `--apply` command was run.

### Firmware build

Command form used:

```powershell
arduino-cli compile --clean --fqbn "esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default" --build-property "compiler.cpp.extra_flags=-DHYDROPONIC_BUILD_PROFILE=1" 02_ESP32_Main_Firmware\Hydroponic_Device001
```

Result: PASS, exit code `0`. Flash usage: 942400 bytes (71%). Static RAM: 47296 bytes
(14%), leaving 280384 bytes. Profile `1` is USB_STAGE1.

Upload to COM5 and flash hash verification also passed with exit code `0`. No claim is made
that this alone validates the unobserved 15-minute scheduled interval or forced watchdog path.

### Source and secret checks

`git diff --check` passed with exit code `0`; only Git line-ending conversion warnings were
printed. Targeted secret scan passed. Runtime Wi-Fi/MQTT values remain only in Git-ignored secret
files and are not included in this report.

## 7. Checks Not Completed

- A complete 15-minute scheduled interval after the final fix was not physically observed.
- The 35-second watchdog was not deliberately forced on physical hardware.
- A new three-point EC-first calibration using the 30-second protocol was not created,
  validated, or activated.
- Post-mixing and calibration-specific acquisition triggers are reserved for later work;
  startup, scheduled, and manual triggers exist now.
- No nutrient dosing or pump hardware test was performed in this phase.

## 8. Component Status

| Component | Status |
|---|---|
| ESP32 firmware | Compiled, uploaded, startup duty cycle physically passed; USB_STAGE1 actuator lock active. |
| Backend | Metadata validation/persistence implemented; 221/221 regression tests passed. |
| Dashboard | Existing Phase 23C read-only integration preserved; verify and Playwright passed. |
| Isolated staging database | Duty metadata received; Auto Dosing false; pump logs 0; dosing runs 0. |
| MQTT staging | Authenticated isolated broker used; one final boot measurement stored without duplicate receipt. |
| EC/TDS hardware | Relay power gating, 30-second settling, OFF voltage, and no 70-second retrigger passed. |
| Pump hardware | Not operated; 12 V supply disconnected throughout Phase 23D. |
| Calibration | Existing active range does not validate the latest duty-cycle reading; dosing remains fail-closed. |

## 9. Risks And Limitations

- Full periodic behavior still needs one uninterrupted 15-minute observation.
- Mechanical relay lifetime is finite; the 15-minute interval keeps switching frequency low,
  but long-term endurance is not measured.
- The latest integrated raw reading (1084, 0.874 V, robust spread 21) is outside current active
  calibration/readiness. It must not be interpreted as a valid nutrient ppm result.
- Earlier isolated staging rows include evidence from the pre-fix immediate-retrigger defect.
  They were retained for audit history and must not be mistaken for final behavior.
- Physical probe fouling and bubbles remain operational risks; power cycling reduces exposure
  but does not replace cleaning, correct immersion, mixing, and certified calibration references.

## 10. Next Work, In Priority Order

1. Observe one complete 15-minute scheduled cycle with the probe untouched; confirm exactly one
   relay ON window and no additional publication before the interval.
2. Exercise the 35-second watchdog using a controlled test profile, with pump power disconnected.
3. Create at least three distinct certified EC reference points using the same 30-second protocol,
   validate monotonicity/range, and activate only after review.
4. Recheck dashboard EC/TDS readiness and stability across three fresh duty-cycle measurements.
5. Only after those gates pass, plan post-mixing acquisition integration; keep Auto Dosing OFF
   until its readiness contract is explicitly satisfied.

## 11. Safety-Critical Source Evidence

- `BuildProfile.h:15-19`: USB_STAGE1 locks actuators and disables MQTT/Serial pump commands.
- `Config.h:17,32-35`: GPIO32, 30-second warm-up, 15-minute interval, 60-second OFF guard,
  and 35-second power watchdog.
- `Sensors.cpp:202-213`: relay output setup and safe initial metadata/state.
- `Sensors.cpp:231-236`: watchdog and warm-up transition.
- `Sensors.cpp:256`: minimum OFF-time calculation.
- `Sensors.cpp:301-304`: schedule due check and bounded measurement completion.
- `EcProbeSchedule.h:4`: pure no-same-loop/no-pending scheduling guard.
- `Hydroponic_Device001.ino:846-854`: power-off completion and guarded scheduling order.
- `PayloadBuilder.cpp:107`: duty-cycle telemetry contract emission.
- `sensorPayloadValidator.js:122-139`: fail-closed metadata relationship validation.
- `sensorLogService.js:33-38`: duty metadata persistence.
- `telemetry_firmware_host_test.cpp:10-13`: host assertions for completion/pending/schedule guards.
- `tdsCalibration.test.js:214-243`: accept complete metadata and reject incomplete/unpowered data.

## 12. Secret Confirmation

No credential, Wi-Fi password, MQTT password, MongoDB URI, token, or private key is included in
this report or intentionally added to tracked source. Runtime credentials remain in Git-ignored
files. A final secret-oriented source scan passed.

## 13. Mandatory Safety Confirmations

- Auto Dosing remained OFF.
- The 12 V pump supply remained disconnected throughout Phase 23D.
- Pump Main, Pump A, and Pump B remained OFF.
- No MQTT pump command was published.
- No dosing run or pump log was created in isolated staging.
- No calibration set was created, activated, retired, or migrated.
- No production database, production broker, or production credential was used.
- The final uploaded firmware used USB_STAGE1 actuator lock.

## 14. Final Conclusion

**PHASE 23D IMPLEMENTED AND PROTOTYPE RUNTIME VERIFIED, WITH TWO OPEN PHYSICAL GATES.**

The relay power path, 30-second acquisition, backend metadata, retry-safe OFF behavior, firmware
compile/upload, and 70-second no-retrigger behavior passed. The system remains fail-closed. A
full 15-minute scheduled observation and forced watchdog test are still unverified and must be
completed before calling the duty-cycle mechanism fully validated.
