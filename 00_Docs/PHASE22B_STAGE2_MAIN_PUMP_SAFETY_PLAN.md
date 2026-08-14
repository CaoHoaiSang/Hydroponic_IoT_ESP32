# Phase 22B Stage 2 - Main Pump Safety Plan

## Scope

Stage 2 will test only the 12 V main circulation pump on MOSFET CH1. Pump A, Pump B,
automatic dosing, nutrient delivery, and indefinite pump ON are outside this test.

This document does not authorize pump operation. Stage 2 remains blocked until the operator
confirms every physical gate below while the 12 V supply is disconnected.

## Current Software Gate

- Firmware remains the `USB_STAGE1` profile.
- All firmware actuator outputs are forced OFF.
- Firmware does not subscribe to the pump-command topic.
- Backend has `PUMP_COMMANDS_DISABLED=true`.
- Broker ACL has no account that may write the pump-command topic.
- Auto Dosing is source-locked OFF.
- The read-only preflight must pass before physical inspection begins.
- TDS control validity is reported but is not a main circulation pump interlock. An unstable
  TDS value continues to block dosing and is carried as a preflight advisory.

Run from `03_Edge_Server/mqtt_backend`:

```powershell
node .\staging\stage1\checkStage2ActuatorReadiness.js
```

## Physical Gate While 12 V Is OFF

- [ ] Adapter 12 V is disconnected from mains.
- [ ] Main pump is the only load connected for this test.
- [ ] Pump A and Pump B power wires are physically disconnected from OUT2/OUT3.
- [ ] Nutrient bottles and Pump A/B tubes remain disconnected.
- [ ] GPIO25 goes only to IN1+ and ESP32 GND goes to IN1-.
- [ ] Adapter positive goes to the MOSFET central positive terminal.
- [ ] Adapter ground, MOSFET central negative, and ESP32 GND share common ground.
- [ ] OUT1 feeds only the main-pump PWM controller and main pump with correct polarity.
- [ ] Main pump is submerged at a safe water level and cannot run dry.
- [ ] PWM knob is set to a low or moderate starting level, not maximum.
- [ ] A correctly rated fuse is installed in the 12 V load path.
- [ ] Adapter plug or switch is reachable for an immediate physical power cut.
- [ ] No exposed conductor can short against water, frame, or another terminal.

## Software To Prepare After Operator Confirmation

The next implementation must use a dedicated build profile and staging command identity with
all of these properties:

1. Subscribe only to an isolated Stage 2 command topic.
2. Accept only `pump=main`, `action=pulse`.
3. Reject `set`, indefinite ON, Pump A, Pump B, and spare commands.
4. Limit the first physical pulse to 1000 ms and enforce an absolute firmware cap of 3000 ms.
5. Keep Serial actuator ON commands disabled.
6. Keep Pump A, Pump B, and spare GPIO outputs forced OFF in every loop.
7. Start and reconnect with every output OFF.
8. Preserve backend publisher and Auto Dosing locks; use a separate one-shot operator tool.
9. Require a unique command ID and verify `started` then `completed` status.
10. Return to the fully locked `USB_STAGE1` profile after the test.

## Planned Physical Sequence

1. Keep 12 V OFF and upload the bounded Stage 2 firmware profile.
2. Confirm Serial reports the Stage 2 profile and all pumps OFF.
3. Verify OUT1 is OFF before connecting pump power.
4. Apply 12 V with the pump submerged; no pump may start automatically.
5. Send exactly one 1000 ms main-pump pulse through the one-shot staging tool.
6. Confirm physical flow, no leak, no abnormal sound, and automatic OFF.
7. Verify MQTT `started` and `completed`, one matching `pump_logs` record, and no dosing run.
8. Disconnect 12 V, upload `USB_STAGE1` again, and confirm all outputs locked OFF.

## Immediate Abort Conditions

Disconnect 12 V immediately for unexpected startup, failure to stop, leak, dry running,
overheating, burning smell, unstable wiring, ESP32 reset loop, MQTT command duplication, or any
Pump A/B activity. Software OFF is not a substitute for cutting physical 12 V power.

## Current Conclusion

The operator confirmed the six physical preparation items while 12 V remained OFF. The bounded
`USB_STAGE2_MAIN_PUMP` profile was compiled, hash-verified on upload, and verified from Serial.
Four forbidden MQTT commands were rejected at runtime with no execution state. Pump A/B/spare
remained locked and Auto Dosing remained OFF before the supervised pulse.

The supervised physical test is complete. Connecting 12 V caused no automatic pump startup.
One armed Main Pump pulse ran for approximately one second and stopped normally; the operator
reported no leak, heat, smell, abnormal sound, or other fault. The token was consumed, the
operator ACL was removed, 12 V was disconnected, and `USB_STAGE1` was restored and verified.

Final conclusion: `STAGE2_MAIN_PUMP_TEST_PASSED_RESTORED_LOCKED`.
