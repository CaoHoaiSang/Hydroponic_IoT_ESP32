# CODEX PHASE 22B STAGE 3 PREFLIGHT REPORT

> Historical software-preflight record. The later Phase 22B closure accepted the project's
> existing Pump A/B physical, MQTT pulse, calibration, and clean-water sequential dosing
> evidence. Profile 3 was not uploaded or physically rerun, and this report's physical
> checklist is no longer the current recommended task.

## Scope

Prepare the software-only gate for a supervised Pump A/B clean-water physical test. The operator
accepted the preceding TDS prototype section and requested progression. This task did not upload
firmware, open a runtime ACL, create an arm token, publish MQTT, enable Auto Dosing, create a
dosing run, connect 12V, or operate any pump.

## Stage 3 Firmware Profile

`HYDROPONIC_BUILD_PROFILE=3` selects `USB_STAGE3_NUTRIENT_PUMPS`:

- MQTT Pump A/B `pulse` is the only actuator path enabled.
- Pump A/B pulse hard cap is 1000 ms.
- Main Pump and spare are locked OFF.
- Continuous `set` commands and all Serial actuator commands are disabled.
- Pump A/B remain mutually exclusive.
- Existing water-level and water-temperature interlocks remain active.
- Authenticated isolated Stage 1 topics and `SecretsStage1.h` are used.
- Stage 1 and Stage 2 profile behavior remains independently compiled by native harness tests.

## Files

- `02_ESP32_Main_Firmware/Hydroponic_Device001/BuildProfile.h`: Stage 3 profile and nutrient-pulse hard cap.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h`: isolated Stage 3 MQTT identity/topics.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/MqttService.cpp`: Stage 3 staging credentials selection.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino`: apply profile cap to both A/B and print the cap at startup.
- `03_Edge_Server/mqtt_backend/test/fixtures/stage3_nutrient_pump_lock_host_test.cpp`: executable profile policy harness.
- `03_Edge_Server/mqtt_backend/test/stage1PreflightSafety.test.js`: Stage 3 profile, checker, and physical-plan regression.
- `03_Edge_Server/mqtt_backend/staging/stage1/checkStage3NutrientPumpReadiness.js`: isolated read-only readiness gate.
- `03_Edge_Server/mqtt_backend/staging/stage1/README.md`: Stage 3 usage and boundary.
- `00_Docs/PHASE22B_STAGE3_NUTRIENT_PUMP_SAFETY_PLAN.md`: physical checklist, sequence, and abort rules.
- `00_Docs/PROJECT_STATUS_REPORT.md`: current phase and next gate.

## Readiness Result

Command:

```powershell
node staging/stage1/checkStage3NutrientPumpReadiness.js
```

Exit code 0; conclusion `READY_FOR_STAGE3_PHYSICAL_CHECKLIST`; `physicalGateOpen=false`.

- Isolated API `127.0.0.1:3101`, MongoDB `127.0.0.1:27019`, and authenticated MQTT port 18885 healthy.
- Telemetry fresh; water level normal; water temperature valid; Pump Main/A/B OFF.
- Auto Dosing OFF; Phase 22 lock ON; active dosing run absent; `dosing_runs=0`.
- Six Stage 2 pump audit/execution logs remain as expected history.
- Stage 1 source lock and Stage 3 bounded profile both present.
- Backend pump publisher locked.
- Pump-command read/write ACL absent.
- Stage 2 runtime closed; arm token and firmware marker absent.
- TDS was control-invalid at the readiness snapshot and remains an Auto Dosing advisory. Per the
  operator's phase acceptance, it does not gate a supervised clean-water mechanical pulse test.

## Verification

### Firmware compile

Arduino CLI 1.5.1 / ESP32 core 3.3.10, full Stage 3 compile, exit code 0:

- Flash: 943,956 / 1,310,720 bytes (72%).
- Static RAM: 47,240 / 327,680 bytes (14%).
- Remaining dynamic memory: 280,440 bytes.

No upload command was run.

### Tests

- Targeted Stage 1/2/3 safety suite: 21 passed, 0 failed, 0 skipped.
- Full backend regression: 213 passed, 0 failed, 0 skipped; exit code 0.
- `node --check`: 55 JavaScript files passed; exit code 0.
- `git diff --check`: exit code 0; only existing Windows LF/CRLF warnings were printed.

## Safety Gate

Before upload, the operator must confirm all physical checklist items in
`00_Docs/PHASE22B_STAGE3_NUTRIENT_PUMP_SAFETY_PLAN.md`: 12V OFF, nutrient bottles disconnected,
separate clean-water intake/outlet cups, Main Pump physically disconnected, A/B visibly OFF,
correct OUT2/OUT3 wiring, no leaks/kinks, and immediate 12V cutoff available.

## Conclusion

`READY_FOR_STAGE3_PHYSICAL_CHECKLIST`
