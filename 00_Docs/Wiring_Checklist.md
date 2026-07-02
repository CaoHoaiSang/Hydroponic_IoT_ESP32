# Wiring Checklist - Hydroponic_IoT_ESP32

## Before Powering Sensors

- [ ] ESP32 powered by USB 5V only
- [ ] TDS VCC connected to 3V3
- [ ] TDS AOUT connected to GPIO34
- [ ] TDS GND connected to common GND
- [ ] DS18B20 VCC connected to 3V3
- [ ] DS18B20 DATA connected to GPIO4
- [ ] 4.7k ohm resistor between DS18B20 DATA and 3V3
- [ ] DS18B20 GND connected to common GND
- [ ] Float switch connected between GPIO27 and GND
- [ ] No 5V signal goes into ESP32 GPIO

## Before MOSFET T05 Test

- [ ] Confirm the MOSFET module is the real IN+/IN- input pair type
- [ ] Do not connect real pumps during the first MOSFET test
- [ ] Prepare a multimeter or a small safe 12V load for output switching verification
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

## First Power-Up Order

1. Power ESP32 through USB.
2. Check Serial Monitor.
3. Test sensors without pumps.
4. For T05, keep pumps disconnected.
5. Connect MOSFET inputs and common ground.
6. Connect adapter +12V only to MOSFET central 正.
7. Connect adapter GND to MOSFET central 负 and ESP32 GND.
8. Verify MOSFET output switching with a multimeter or small safe 12V load.
9. Test real pumps only after MOSFET output is verified.
