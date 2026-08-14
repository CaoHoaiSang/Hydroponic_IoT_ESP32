# Phase 22B Stage 3 - Pump A/B Clean-Water Safety Plan

## Scope

Stage 3 verifies Pump A and Pump B through MOSFET CH2/CH3 using clean water only. It does not
perform nutrient dosing, calibration, Auto Dosing, or simultaneous pumping.

## Firmware Boundary

Compile with `HYDROPONIC_BUILD_PROFILE=3` (`USB_STAGE3_NUTRIENT_PUMPS`). The profile:

- Allows only MQTT `pulse` commands for Pump A or Pump B.
- Limits each nutrient-pump pulse to 1000 ms.
- Rejects Main Pump, spare, continuous `set`, Serial actuator commands, and pulses over 1000 ms.
- Keeps Pump A and Pump B mutually exclusive.
- Retains water-level and water-temperature interlocks.
- Uses isolated authenticated Stage 1 MQTT topics and credentials.

The backend publisher remains disabled and Auto Dosing remains locked OFF. A future supervised
operator tool may receive one narrow, expiring, single-use permission; no such gate is opened by
the read-only preflight.

TDS control validity remains visible as an Auto Dosing advisory, but it is not a mechanical
interlock for this supervised clean-water pulse test. Water level, water temperature, all-pumps-
OFF state, Auto Dosing OFF, zero dosing runs, ACL closure, and the firmware bounds remain required.

## Physical Checklist Before Upload

- [ ] 12V pump supply is disconnected.
- [ ] Nutrient A and B bottles are disconnected and physically away from the intake tubes.
- [ ] Pump A intake tube is placed in clean water and outlet goes to a visible collection cup.
- [ ] Pump B intake tube is placed in clean water and outlet goes to a separate visible cup.
- [ ] Pump A is connected only to MOSFET OUT2 and GPIO26/IN2+.
- [ ] Pump B is connected only to MOSFET OUT3 and GPIO14/IN3+.
- [ ] Main Pump is physically disconnected from OUT1 for Stage 3 isolation.
- [ ] Spare OUT4 is unused.
- [ ] Common ground wiring is intact.
- [ ] Tubes are not blocked, kinked, or aimed at electronics.
- [ ] An immediate 12V power cutoff is within reach.
- [ ] ESP32 remains powered by USB and all pumps are visibly OFF.

## Software Sequence

1. Run `node staging/stage1/checkStage3NutrientPumpReadiness.js` with 12V OFF.
2. Compile profile 3 and review native/source regression results.
3. Obtain the operator's exact physical-checklist confirmation.
4. Upload profile 3 while 12V remains OFF.
5. Verify the Serial banner and all Stage 3 locks.
6. With 12V still OFF, prove forbidden Main Pump, `set`, spare, simultaneous, and over-limit
   commands are rejected.
7. Connect 12V and confirm no pump starts automatically.
8. Arm and run one fixed 1000 ms Pump A clean-water pulse; observe stop and leaks.
9. Return to safe state before separately arming Pump B.
10. Run one fixed 1000 ms Pump B clean-water pulse; observe stop and leaks.
11. Disconnect 12V, remove command ACL/markers, restore `USB_STAGE1`, and verify all locks.

## Abort Conditions

Immediately disconnect 12V if a pump starts without the one-shot command, runs longer than one
second, both pumps run together, the wrong channel runs, tubing leaks, wiring heats, or any sound,
smell, vibration, or electrical behavior is abnormal.

## Current Gate

`SOFTWARE_PREPARATION_ONLY`. No upload, runtime ACL, arm token, MQTT command, or physical pump
operation is authorized by this document.
