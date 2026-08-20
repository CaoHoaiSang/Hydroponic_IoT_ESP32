# Wiring Checklist - Hydroponic_IoT_ESP32

## Before Powering Sensors

- [ ] ESP32 powered by USB 5V only
- [ ] TDS VCC connected to relay NO; relay COM connected to ESP32 5V
- [ ] TDS AOUT connected to GPIO34
- [ ] TDS GND connected to common GND
- [ ] Relay VCC connected to ESP32 5V
- [ ] Relay GND connected directly to ESP32 GND
- [ ] Relay IN connected to GPIO32
- [ ] 10k ohm pull-down resistor connected between relay IN and GND
- [ ] Relay trigger jumper set to HIGH
- [ ] Relay NC left disconnected
- [ ] Relay stays OFF during ESP32 boot/reset
- [ ] Confirm TDS AOUT is the signal pin and is not shorted to the 5V VCC pin
- [ ] Confirm measured/observed TDS AOUT remains within the SEN0244 0-2.3V specification
- [ ] TDS probe is rinsed and free of deposits
- [ ] TDS probe is fully immersed at the intended depth and free of trapped air bubbles
- [ ] TDS probe is not touching the container wall
- [ ] DS18B20 VCC connected to 3V3
- [ ] DS18B20 DATA connected to GPIO4
- [ ] 4.7k ohm resistor between DS18B20 DATA and 3V3
- [ ] DS18B20 GND connected to common GND
- [ ] Float switch connected between GPIO27 and GND
- [ ] No 5V signal goes into ESP32 GPIO

The relay switches the SEN0244 signal-conditioning board's 5V supply. It does not switch AOUT or
GND and does not connect 5V to GPIO34. Only AOUT connects to GPIO34. Official specification:
<https://wiki.dfrobot.com/sen0244/>.

## Verified SEN0244 Relay Measurements

- Relay-only pulse: physical click/LED ON then OFF passed.
- Relay NO without sensor: 4.55V ON; approximately 300mV and falling when OFF.
- SEN0244 connected: 4.57V ON; 53.9mV OFF.
- SEN0244 AOUT with relay OFF: 0V; no observed back-power through GPIO34.
- SEN0244 LED: ON only during the bounded relay pulse and OFF afterward.
- Keep Auto Dosing and all pump outputs OFF while validating the measurement schedule.

## Before TDS Calibration Or Control Validation

1. Keep 12V pump power disconnected during sensor diagnosis.
2. Rinse the probe with clean water and remove visible deposits without damaging the electrodes.
3. Remove all trapped bubbles and place the probe away from the container wall.
4. Secure the probe cable so it cannot move the electrode and keep AOUT wiring away from pump
   power/PWM wiring.
5. After cleaning, leave the probe stationary for at least 10 minutes before starting the formal
   validation window; this is a project-observed settling period, not a new calibration value.
6. Compare the same solution with the handheld EC/TDS meter.
7. Require `tdsWindowStable=true`, `tdsStable=true`, `tdsCalibrationInRange=true`, and
   `tdsControlValid=true` before accepting the result.
8. Do not recalibrate around a fouled probe, bubbles, loose wiring, or an out-of-range voltage.

## MOSFET Power And Input Wiring

- [ ] Confirm the MOSFET module is the real IN+/IN- input pair type
- [ ] GPIO25 connected to IN1+
- [ ] ESP32 GND connected to IN1-
- [ ] GPIO26 connected to IN2+
- [ ] ESP32 GND connected to IN2-
- [ ] GPIO14 connected to IN3+
- [ ] ESP32 GND connected to IN3-
- [ ] GPIO33 connected to IN4+
- [ ] ESP32 GND connected to IN4-
- [ ] All IN- terminals share ESP32 GND / common GND
- [ ] MOSFET central 正 connected to adapter +12V
- [ ] MOSFET central 负 connected to adapter GND / common GND
- [ ] ESP32 GND connected to MOSFET central 负
- [ ] ESP32 GND connected to adapter 12V GND
- [ ] MOSFET central 负 and adapter GND are the same common ground node
- [ ] Do not connect +12V to any ESP32 GPIO
- [ ] Do not connect MOSFET central 正 to ESP32
- [ ] Do not connect pump power directly to ESP32

## Main Pump Wiring After T06

- [ ] Main pump ON/OFF through MOSFET CH1 has passed
- [ ] GPIO25 connected to IN1+
- [ ] ESP32 GND connected to IN1-
- [ ] MOSFET OUT1+ connected to DC PWM speed controller IN+
- [ ] MOSFET OUT1- connected to DC PWM speed controller IN-
- [ ] DC PWM speed controller OUT+ connected to main circulation pump +
- [ ] DC PWM speed controller OUT- connected to main circulation pump -
- [ ] DC PWM speed controller is placed after MOSFET OUT1 and before the main pump
- [ ] DC PWM speed controller is not placed before the MOSFET module power input
- [ ] DC PWM speed controller affects only the main circulation pump
- [ ] Pump A and Pump B are not routed through the main pump speed controller
- [ ] Speed controller knob can adjust main pump power/flow
- [ ] Speed controller is hardware-only in the current phase
- [ ] ESP32 still only controls main pump ON/OFF through GPIO25 and MOSFET CH1
- [ ] Speed feedback or software speed control is not implemented

## Before T07 Pump A/B Test

- [ ] Use clean water only
- [ ] Do not connect nutrient A/B bottles yet
- [ ] Pump A + connected to OUT2+
- [ ] Pump A - connected to OUT2-
- [ ] Pump B + connected to OUT3+
- [ ] Pump B - connected to OUT3-
- [ ] GPIO26 connected to IN2+
- [ ] ESP32 GND connected to IN2-
- [ ] GPIO14 connected to IN3+
- [ ] ESP32 GND connected to IN3-
- [ ] MOSFET central 正 connected to adapter +12V
- [ ] MOSFET central 负 connected to adapter GND / common GND
- [ ] ESP32 GND connected to MOSFET central 负 / common GND
- [ ] Pump A and Pump B are not run at the same time during T07

## First Power-Up Order

1. Power ESP32 through USB.
2. Check Serial Monitor.
3. Test sensors without pumps.
4. Verify MOSFET output switching before connecting pumps.
5. For main pump, keep the DC PWM speed controller after MOSFET OUT1 and before the pump.
6. For T07, connect Pump A to OUT2 and Pump B to OUT3.
7. Use clean water only for Pump A/B testing.
8. Keep nutrient A/B bottles disconnected until a later calibration task.
