# CODEX PHASE 22B TDS RECOVERY REPORT

## Scope

Verify the post-Stage-2 TDS recovery in the isolated Stage 1 environment after the firmware was
restored to `USB_STAGE1`. This work was observation-only: no firmware change/upload, calibration
lifecycle write, MQTT publish, Auto Dosing action, dosing run, or pump operation was performed.

## Implementation

- Added `staging/stage1/Run-Stage1-TdsRecoveryCheck.ps1` as a repeatable read-only observation.
- The check requires contiguous accepted telemetry from one boot, stable firmware windows,
  backend TDS stability, in-range active calibration, non-null TDS ppm, valid water temperature,
  normal water level, and all pumps OFF.
- It also requires Auto Dosing OFF, the Phase 22 lock ON, zero dosing runs before/after, no active
  dosing run, and zero pump-command MQTT messages during the observation.
- Windows standby is inhibited during the check and restored afterward.
- UTC freshness uses `DateTimeOffset` and must be between -5 and 45 seconds.
- Added two regression tests proving the script is read-only and includes every required TDS,
  water, actuator, and dosing gate.

## Runtime Evidence

The first 5-minute collection produced 10/10 stable and control-valid measurements, but its
freshness field exposed a PowerShell UTC parsing defect. That result was not accepted. The script
was corrected to use `DateTimeOffset` and to reject ages below -5 seconds.

The first corrected 5-minute run correctly failed because one real transient occurred:

- Boot: `cc37dbd923c55f65`; sequences 28-37; 10 contiguous accepted measurements.
- Sequence 37: 692.80 ppm; three-measurement spread 24.02 ppm versus 21.39 ppm threshold.
- Firmware window remained stable, but backend set `tdsStable=false` and
  `tdsControlValid=false` as designed.
- Zero pump commands, zero dosing runs, Auto Dosing OFF, all pumps OFF.
- Sequence 38 recovered to 710.61 ppm, `tdsStable=true`, and `tdsControlValid=true`.

A second corrected 5-minute run passed:

- Time: 2026-08-14T11:19:59.922Z to 2026-08-14T11:25:00.080Z.
- Boot: `cc37dbd923c55f65`; sequences 39-48; 10/10 contiguous accepted measurements.
- Active set: `tds_set_1786679483159_b8f307f8`.
- All windows stable, all backend stability checks true, all control-valid, all in range.
- TDS: 688.10-711.87 ppm; average 695.65 ppm; standard deviation 5.89 ppm.
- Full raw spread: 18-65; robust spread: 11-35.
- Maximum telemetry interval: 30.242 seconds; latest age: 25.59 seconds.
- Water temperature valid and water level normal for every measurement.
- Pump Main/A/B OFF for every measurement.
- Pump-command messages during observation: 0.
- Dosing runs before/after: 0/0; active dosing run: none.
- Auto Dosing: OFF; Phase 22 lock: ON.
- Isolated backend, MongoDB, and MQTT health: PASS.
- Script exit code: 0; result: PASS.

Final snapshot after regression: sequence 55 reported 673.83 ppm with firmware window stable,
backend stability true, control-valid true, and calibration in range. Water remained normal,
Pump Main/A/B were OFF, Auto Dosing was OFF, the Phase 22 lock was ON, and dosing runs remained
zero. The runtime ACL contained zero pump-command read/write lines; no Stage 2 arm or firmware
marker remained.

## Safety Status

- The operator reported the 12 V pump supply disconnected before this work.
- Firmware remains `USB_STAGE1`, with no pump-command subscription and all actuator paths locked.
- No production endpoint or credential was used.
- No secret is included in this report.

## Interpretation

The prior null TDS state after reset was a fail-closed startup/noise condition, not a lost active
calibration. Calibrated TDS has recovered and a clean 5-minute confirmation passed. One later
single-measurement backend stability rejection was observed and recovered on the next payload;
therefore the system is safe and fail-closed, but the sensor should remain under passive
observation before another actuator phase.

## Verification

- PowerShell parser for the recovery script: PASS.
- Targeted Stage 1 safety suite: 17 passed, 0 failed, 0 skipped.
- Full backend regression: 209 passed, 0 failed, 0 skipped; exit code 0.
- `node --check`: 54 JavaScript files passed; exit code 0.
- `git diff --check`: PASS; exit code 0. Git emitted only the existing Windows LF/CRLF warnings.
- Firmware was not changed, compiled, or uploaded during this observation.

## Conclusion

The initial 5-minute recovery was not sufficient to authorize another actuator phase. A later
extended observation, recorded below, exposed sustained signal drift and a separate connectivity
gap. The superseding conclusion is:

`BLOCKED_TDS_SIGNAL_DRIFT_AND_CONNECTIVITY`

## Extended Observation

The first attempted 15-minute run started from an already stale sequence 58. The ESP32 had
stopped publishing at 2026-08-14T11:29:34.743Z, the broker timed the client out, and it later
returned with a new boot ID. The original script filtered to the starting boot and ended with a
generic no-telemetry error. This run was not scored as a TDS stability result.

The checker was hardened before retry:

- Initial telemetry must be control-valid, pumps OFF, and between -5 and 45 seconds old.
- A changed boot ID produces an explicit boot-transition failure.
- Any MQTT disconnect/reconnect/timeout event during the window makes the run fail.
- The Windows execution-state restoration now also covers preflight failures.

The corrected 15-minute observation ran from 2026-08-14T11:50:50.532Z through
2026-08-14T12:05:50.656Z on boot `5d464b9a7b6745a6`, sequences 22-51:

- 30/30 measurements were contiguous, accepted, and from one boot.
- MQTT connection events during the measured window: 0.
- Firmware windows stable: 30/30; calibration in range: 30/30; TDS ppm non-null: 30/30.
- Backend control-invalid measurements: 10/30; final measurement control-invalid.
- TDS range: 490.90-687.21 ppm; average 620.08 ppm; standard deviation 59.23 ppm.
- Raw ADC moved from the observed peak 2541 / 2.047 V to 1748 / 1.409 V.
- Full raw spread remained 43-66 and robust spread 33-50, so the drift occurred between stable
  firmware windows rather than as a single noisy ADC window.
- Water temperature stayed in the narrow 29.69-29.75°C range.
- Water level remained normal; Pump Main/A/B remained OFF.
- Pump-command messages: 0; dosing runs before/after: 0/0; active dosing run: none.
- Auto Dosing remained OFF and the Phase 22 lock remained ON.
- Script exit code: 1; result: FAIL.

After this measured window, the backend MQTT client also disconnected and reconnected. A delayed
payload at sequence 53 was stored fail-closed with `tds_measurement_stale`; it did not create a
dosing run or pump command.

The final safety snapshot at sequence 56 showed the drift continuing to raw ADC 384 / 0.309 V.
That value was outside the active calibration range, so the backend correctly returned
`tdsPpm=null`, `tdsStable=false`, and `tdsControlValid=false` with reasons
`tds_outside_calibration_range`, `tds_calibration_warning`, `tds_value_invalid`, and
`tds_unstable`. Water remained normal at 29.69°C and Pump Main/A/B remained OFF. Auto Dosing was
OFF, the Phase 22 lock was ON, dosing runs were zero, and the runtime ACL had zero pump-command
read/write lines.

No threshold or calibration value was changed in response. Pump A/B preparation is blocked until
the physical TDS signal and the ESP32 USB/Wi-Fi continuity are diagnosed and a new extended
read-only observation passes.

## Operator-Identified Physical Cause And Wiring Correction

The operator confirmed that the project powers SEN0244 VCC from ESP32 5V, not 3V3. This matches
the current runtime/backend notes and the official SEN0244 input range of 3.3-5.5V. GPIO34 still
receives only AOUT; the official AOUT range is 0-2.3V. `Pin_Map.md` and
`Wiring_Checklist.md` were synchronized to this project configuration.

The operator also identified long-use electrode deposits and trapped air bubbles on the probe as
the physical cause of the falling readings. This is consistent with the observed gradual raw ADC
collapse across individually stable windows. The cause is recorded as operator-identified, while
runtime recovery remains unverified until the probe is cleaned, bubbles are removed, and a fresh
15-minute read-only check passes.

## Post-Clean Revalidation

The operator cleaned the probe, removed deposits/bubbles, and reported it stable. Preflight then
showed raw ADC 2503 / 2.017 V, 690.14 ppm, calibration in range, and control-valid telemetry.

The first post-clean 15-minute run covered boot `a7a212c17491cfb5`, sequences 10-39:

- 30 contiguous accepted measurements; one boot; no MQTT connection event.
- All 30 firmware windows stable and all 30 values in calibration range.
- Six backend control-invalid measurements occurred in early settling clusters at sequences
  11, 13-14, and 23-25.
- Sequences 26-39 then produced 14 consecutive control-valid measurements; the final ten ranged
  from 701.78 to 720.00 ppm.
- TDS range for the full run: 660.57-724.77 ppm; average 708.45 ppm.
- Pump commands: 0; dosing runs before/after: 0/0; all pumps OFF; Auto Dosing OFF.
- Strict script result: FAIL, exit code 1.

After the additional settling period, a second independent 15-minute run covered sequences
41-70:

- 30 contiguous accepted measurements; one boot; no MQTT connection event.
- 29/30 measurements were control-valid and all 30 remained in calibration range.
- One isolated firmware-window rejection occurred at sequence 64: raw min/max 2235/2504,
  full spread 269, robust spread 221, and reason `tds_window_unstable`.
- Six following measurements recovered automatically and the final measurement was control-valid.
- TDS range: 660.90-710.15 ppm; average 696.55 ppm; standard deviation 10.19 ppm.
- Water temperature and level valid; Pump Main/A/B OFF throughout.
- Pump commands: 0; dosing runs before/after: 0/0; Auto Dosing OFF; Phase 22 lock ON.
- Strict script result: FAIL, exit code 1.

The sustained voltage collapse has been resolved by maintenance, but the strict 30/30 quality
gate has not passed because one isolated noisy firmware window remains. No threshold or
calibration adjustment was made. The probe/cable should remain secured and separated from power
wiring, then another formal validation may be run after a fresh settling period.

Superseding post-clean conclusion:

`PARTIAL_TDS_DRIFT_RESOLVED_SINGLE_WINDOW_NOISE_REMAINS`
