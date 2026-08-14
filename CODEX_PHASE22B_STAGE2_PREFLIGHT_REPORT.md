# CODEX PHASE 22B STAGE 2 PREFLIGHT REPORT

## Scope

Prepare, execute, and safely close a bounded Main Pump-only Stage 2 physical test after the
operator confirmed every physical checkpoint.

## Safety Boundary

- Stage 2 firmware was compiled and uploaded while 12 V remained disconnected.
- Four deliberately forbidden MQTT commands were published and all were rejected.
- Exactly one valid 1000 ms Main Pump pulse produced `started` then `completed`.
- Auto Dosing remained OFF and Phase 22 remained locked.
- Pump A/B/spare were never operated.
- Production database, broker, topics, and credentials were not accessed.

## Files

- `03_Edge_Server/mqtt_backend/staging/stage1/checkStage2ActuatorReadiness.js`: fail-closed, read-only staging and source preflight.
- `03_Edge_Server/mqtt_backend/staging/stage1/Prepare-Stage2-MainPumpRuntime.ps1`: runtime-only operator identity and narrow ACL preparation.
- `03_Edge_Server/mqtt_backend/staging/stage1/Verify-Stage2-Firmware.ps1`: Serial profile verification and expiring marker.
- `03_Edge_Server/mqtt_backend/staging/stage1/Arm-Stage2-MainPumpPulse.ps1`: exact-confirmation, five-minute arm token.
- `03_Edge_Server/mqtt_backend/staging/stage1/runStage2MainPumpPulse.js`: single-use fixed 1000 ms Main Pump pulse tool; run exactly once.
- `03_Edge_Server/mqtt_backend/staging/stage1/runStage2RejectedCommandChecks.js`: fixed forbidden-command runtime checks.
- `03_Edge_Server/mqtt_backend/staging/stage1/Disable-Stage2-MainPumpRuntime.ps1`: remove operator/device command ACL and expiring markers.
- `03_Edge_Server/mqtt_backend/staging/stage1/Verify-Stage1-Restore.ps1`: verify final locked firmware banner and absent subscription.
- `00_Docs/PHASE22B_STAGE2_MAIN_PUMP_SAFETY_PLAN.md`: physical gate, bounded test design, sequence, and abort criteria.
- `CODEX_PHASE22B_STAGE2_PREFLIGHT_REPORT.md`: this consolidated handoff.
- `00_Docs/PROJECT_STATUS_REPORT.md`: project phase and next operator gate.

## Executed Checks

Command:

```powershell
node .\staging\stage1\checkStage2ActuatorReadiness.js
```

Exit code `0`. Result: `READY_FOR_OPERATOR_PHYSICAL_CONFIRMATION`.

- API: isolated `127.0.0.1:3101` healthy.
- MongoDB: isolated `127.0.0.1:27019/hydroponic_stage1_preflight` healthy.
- MQTT: isolated authenticated broker on port `18885` healthy.
- Final measurement sequence: `14`; telemetry age: `23,658 ms`.
- Water level: normal; water temperature valid.
- Pump Main/A/B: all OFF.
- Auto Dosing: OFF; Phase 22 lock: ON; active dosing run: none.
- `dosing_runs=0`; `pump_logs=0`.
- Broker `Received PUBLISH` count on the pump-command topic: `0`.
- Firmware Stage 1 actuator lock: present.
- Backend publisher lock: present.
- ACL pump-command write permission: absent.

TDS control validity was false at this snapshot and `tdsPpm` was null after recent unstable
measurements. This remains a dosing-blocking advisory. It is not a circulation-pump interlock;
the main-pump physical gate still requires fresh telemetry, normal water level, valid water
temperature, all pumps OFF, and every isolation/zero-side-effect check.

Targeted test:

```powershell
node --test test\stage1PreflightSafety.test.js
```

Exit code `0`: 8 passed, 0 failed, 0 skipped. The test proves the preflight uses only fixed
loopback staging endpoints, cannot open the physical gate, contains no MQTT publish or database
write operation, and keeps invalid TDS as an Auto Dosing advisory.

Full regression:

```powershell
npm test
```

An earlier pre-profile run passed 200/200. The final result after physical test, runtime disable,
and Stage 1 restore is exit code `0`: 207 passed, 0 failed, 0 skipped.

### Stage 2 firmware build

Build profile: `HYDROPONIC_BUILD_PROFILE=2`; Arduino CLI `1.5.1`; ESP32 core `3.3.10`.

Exit code `0`:

- Flash: 943,824 / 1,310,720 bytes (72%).
- Static RAM: 47,240 / 327,680 bytes (14%).
- Remaining dynamic memory: 280,440 bytes.

### Upload and Serial verification

The first upload attempt stopped before flash write with wrong boot mode `0x17`. After the
operator held BOOT, upload to COM5 exited `0` and all written hashes verified.

Serial verification confirmed:

- `Build profile: USB_STAGE2_MAIN_PUMP`.
- Main Pump actuation enabled only through the bounded MQTT pulse path.
- Pump A/B locked OFF.
- Serial actuator commands disabled.
- Continuous Main Pump control disabled.
- Authenticated subscription to `stage1/hydroponic/device001/pump/cmd`.

### Runtime rejection checks with 12 V OFF

Four commands were sent: Main Pump `set/on`, Pump A pulse 1000 ms, Pump B pulse 1000 ms, and
Main Pump pulse 3001 ms. All four returned `accepted=false`, `status=rejected`; execution
statuses were zero. MongoDB contains four matching rejected audit logs and zero dosing runs.
No valid Main Pump pulse was sent during these negative checks.

### Supervised physical pulse and restore

After the operator confirmed 12 V connection caused no automatic startup, all software
interlocks passed and a five-minute single-use token was armed. The one-shot tool published
exactly one command:

- Command ID: `stage2_main_1786704830654_51341a11`.
- Pump/action/duration: `main` / `pulse` / `1000 ms`.
- Status sequence: `started`, `completed`.
- Matching pump logs: `2`.
- Dosing runs before/after: `0` / `0`.
- Arm token consumed: `true`.

The operator physically observed the Main Pump run for approximately one second and stop with
no abnormal condition. No Pump A/B activity occurred.

The operator ACL and device command-read ACL were then removed, all Stage 2 markers were
deleted, and broker/backend health recovered. The operator reported 12 V disconnected before
restore. Current-source profile 1 compiled successfully:

- Flash: 938,980 / 1,310,720 bytes (71%).
- Static RAM: 47,240 / 327,680 bytes (14%).

The first restore upload attempt stopped before writing because the ESP32 was not in download
mode. After BOOT was held, COM5 upload exited `0` and all hashes verified. Final Serial evidence:

- `Build profile: USB_STAGE1`.
- Main Pump and Pump A/B actuation: `LOCKED OFF`.
- Serial actuator commands: `DISABLED`.
- MQTT pump command subscription: `DISABLED BY BUILD PROFILE`.
- No subscription to the pump-command topic.

## Physical Status

The operator confirmed the physical checklist and later confirmed the one-second pulse stopped
normally without an abnormal condition. Codex cannot independently inspect the hardware. The
12 V supply was reported disconnected before the final Stage 1 restore. No nutrient pump or
Auto Dosing operation occurred.

## Post-Restore TDS Recovery

The earlier null TDS advisory was investigated in read-only Stage 1 mode. The active calibration
remained present and calibrated values returned automatically after stable post-reset windows.
One corrected 5-minute observation detected a single backend stability rejection at sequence 37
(692.80 ppm; spread 24.02 ppm versus threshold 21.39 ppm); sequence 38 recovered without any
operator action. A subsequent corrected 5-minute observation passed on sequences 39-48: 10/10
contiguous accepted, stable, control-valid, and in-range measurements, averaging 695.65 ppm.
There were zero pump-command messages and zero dosing runs; all pumps remained OFF and Auto
Dosing remained OFF. See `CODEX_PHASE22B_TDS_RECOVERY_REPORT.md` for complete evidence.

## Conclusion

`STAGE2_MAIN_PUMP_TEST_PASSED_RESTORED_LOCKED`
