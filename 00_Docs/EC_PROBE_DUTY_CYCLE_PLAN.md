# EC Probe Duty-Cycle Protection Plan

## Status

- Design status: relay circuit reviewed and electrically validated for supervised prototype use.
- Runtime status: T09/T10 and main firmware duty cycling are implemented and physically exercised.
- Current wiring is `ESP32 5V -> relay COM -> relay NO -> SEN0244 VCC`, with AOUT on GPIO34.
- GPIO32 is the official active-HIGH relay input with an external 10k ohm pull-down to GND.
- Auto Dosing remains OFF.

## Why Software Sampling Alone Is Not Enough

Calling `analogRead()` less often does not remove power from the SEN0244 board. With the current
direct 5V wiring, the probe electronics remain energized continuously even when firmware ignores
the ADC value. A real duty cycle therefore requires a hardware power switch on the sensor's 5V
supply. Duty cycling may reduce energized exposure, but it does not replace probe cleaning,
bubble removal, correct placement, circulation, or periodic comparison with a reference meter.

## Required Hardware Change

The supervised prototype uses the dry contact of a BLK Mini 1-channel 5V relay between ESP32 5V
and SEN0244 VCC. A solid-state high-side load switch remains preferable for a later production
revision, but is not required to continue the bounded prototype validation.

- The switch must default OFF while ESP32 boots or resets.
- ESP32 and sensor grounds remain common.
- SEN0244 AOUT remains on GPIO34.
- Do not power the sensor from an ESP32 GPIO.
- Do not route the 5V sensor supply through the existing 12V pump MOSFET output.
- Add local decoupling according to the selected switch/module datasheet.
- Verify that AOUT is not back-powering the sensor while VCC is OFF.

GPIO32 relay control passed compile, upload, default-OFF, bounded pulse, physical click/LED,
contact-voltage, sensor-voltage, and AOUT back-power checks. T10 selected a conservative
30-second warm-up after three supervised cycles. The first cycle drifted across the window;
cycles two and three were repeatable around raw ADC 2777-2783 with robust spreads at or below 31.

## Proposed Fail-Closed State Machine

| State | Sensor power | TDS/EC control validity | Transition |
|---|---:|---:|---|
| `POWERED_OFF` | OFF | Invalid | Scheduled or supervised measurement request |
| `WARMING_UP` | ON | Invalid | Configured stabilization time elapsed |
| `SAMPLING` | ON | Invalid | Full 30-sample window collected |
| `READY` | ON | Valid only if all downstream quality gates pass | Publish attempt, then power OFF |
| `FAULT_LOCKOUT` | OFF | Invalid | Manual inspection/reset only |

Implemented prototype defaults:

- Scheduled measurement interval: 15 minutes.
- Startup measurement: one window after network initialization.
- Post-dosing measurement: not connected yet; future work after the current locked-off phase.
- Warm-up time: 30 seconds, selected conservatively from T10.
- Existing ring buffer: 30 samples at 40 ms.
- Maximum continuous sensor-on watchdog: 35 seconds.
- Minimum sensor-off interval: 60 seconds, except a supervised maintenance test.

## Measurement Triggers

1. Periodic schedule while the system is in monitoring mode.
2. A manual Serial `measure_ec` maintenance measurement that cannot control pumps.
3. A future post-mixing trigger after the existing dosing mixing delay expires.
4. A future supervised calibration capture trigger.

No trigger may directly publish a pump command. A measurement only updates telemetry. Existing
backend readiness and Auto Dosing interlocks remain authoritative.

## Payload And Backend Contract

Future telemetry should explicitly include:

```json
{
  "ecProbePowerMode": "duty_cycle",
  "ecProbePowered": true,
  "ecProbeState": "READY",
  "ecProbeWarmupMs": 30000,
  "ecProbePoweredAtUptimeMs": 1000,
  "ecProbeMeasurementTrigger": "scheduled",
  "tdsWindowStable": true
}
```

Only complete windows are published. During OFF and warm-up periods, no new EC/TDS measurement is
created; the previous row becomes stale and is excluded by existing freshness gates. If MQTT is
unavailable, firmware retries the same payload and identity but leaves the relay OFF. Backend
storage treats `ecProbePowered=true` and `ecProbeState=READY` as acquisition-time snapshots.

## Safety Acceptance Gates

Before enabling duty-cycle firmware:

1. Review the exact relay circuit and approve one official GPIO. **Passed: GPIO32.**
2. Verify default OFF with ESP32 disconnected, booting, and resetting. **Passed.**
3. Verify sensor VCC is near 0V when OFF and in the 3.3-5.5V range when ON. **Passed: 53.9mV / 4.57V.**
4. Verify GPIO34 is not back-powering the unpowered board. **Passed: AOUT 0V while OFF.**
5. Measure warm-up settling over repeated cycles. **Passed for prototype selection: 30 seconds.**
6. Confirm startup/manual windows and no immediate schedule retrigger. **Passed. Full 15-minute schedule, calibration, and post-mixing triggers remain unverified/not implemented.**
7. Confirm watchdog timeout powers the sensor OFF and publishes no valid control value. **Implemented and compiled; forced-timeout physical test pending.**
8. Run regression with Auto Dosing locked OFF. **Passed: Backend 221/221; frontend source unchanged.**
9. Compare drift and deposit buildup against the current continuous-power baseline over several days.

Duty cycling is active in the uploaded `USB_STAGE1` firmware. It is still prototype evidence, not
production qualification. Auto Dosing remains OFF, the uploaded profile locks every pump OFF,
and the active EC/TDS calibration must be revalidated under this exact measurement protocol.
