# Pin Map - Hydroponic_IoT_ESP32

## Board

| Item | Value |
|---|---|
| Board | ESP32-WROOM-32U DevKitC V4 |
| Device ID | device001 |
| Project phase | Core phase |

## Sensor Pins

| Sensor | Sensor Pin | ESP32 Pin | Notes |
|---|---|---|---|
| DFRobot Gravity Analog TDS Sensor SEN0244 | AOUT | GPIO34 | Analog input only |
| DS18B20 waterproof temperature sensor | DATA | GPIO4 | Requires 4.7k ohm pull-up resistor to 3.3V |
| Water level float switch | Signal wire | GPIO27 | Other wire goes to Common GND |

## MOSFET Module Type

The real 4-channel MOSFET module used in this project is the input-pair/output-pair type.

It does not use the old shared `Logic VCC`, `Logic GND`, `IN1`, `IN2`, `IN3`, `IN4` assumption.

Each channel has:

| Channel | Input Pair | Output Pair |
|---|---|---|
| CH1 | IN1+ / IN1- | OUT1+ / OUT1- |
| CH2 | IN2+ / IN2- | OUT2+ / OUT2- |
| CH3 | IN3+ / IN3- | OUT3+ / OUT3- |
| CH4 | IN4+ / IN4- | OUT4+ / OUT4- |

The module also has two central power terminals:

| Module Marking | Meaning | Connection |
|---|---|---|
| 正 | Positive power terminal | Adapter +12V |
| 负 | Negative power terminal | Adapter GND / common GND |

## MOSFET Input Wiring

| MOSFET Channel | ESP32 GPIO Signal | MOSFET Input + | MOSFET Input - | Later Load |
|---|---|---|---|---|
| CH1 | GPIO25 | IN1+ | IN1- to ESP32 GND / common GND | Main circulation pump |
| CH2 | GPIO26 | IN2+ | IN2- to ESP32 GND / common GND | Pump A |
| CH3 | GPIO14 | IN3+ | IN3- to ESP32 GND / common GND | Pump B |
| CH4 | GPIO33 | IN4+ | IN4- to ESP32 GND / common GND | Spare output |

All IN- terminals may share the same ESP32 GND / common GND node.

## MOSFET Power Wiring

| Connection | Destination |
|---|---|
| MOSFET central 正 | Adapter +12V |
| MOSFET central 负 | Adapter GND / common GND |
| ESP32 GND | MOSFET central 负 |
| ESP32 GND | Adapter 12V GND |

ESP32 GND, MOSFET central 负, and adapter 12V GND must be connected together as one common ground node.

## MOSFET Output Wiring For Later

Do not connect real pumps during the first MOSFET test.

| MOSFET Output Pair | Later Use |
|---|---|
| OUT1+ / OUT1- | Main circulation pump later |
| OUT2+ / OUT2- | Pump A later |
| OUT3+ / OUT3- | Pump B later |
| OUT4+ / OUT4- | Spare output later |

For T05, use a multimeter or a small safe 12V load to verify output switching.

## Pump Mapping

| Pump | Voltage | Controlled By | ESP32 GPIO | MOSFET Input |
|---|---|---|---|---|
| Main circulation pump | 12V DC | MOSFET CH1 | GPIO25 | IN1+ |
| Peristaltic pump A | 12V DC | MOSFET CH2 | GPIO26 | IN2+ |
| Peristaltic pump B | 12V DC | MOSFET CH3 | GPIO14 | IN3+ |

## Safety Notes

- Do not connect pumps during the first MOSFET test.
- Do not connect pump power directly to ESP32.
- Do not connect +12V to any ESP32 GPIO.
- Do not connect the MOSFET central 正 terminal to ESP32.
- ESP32 only controls IN+ pins with GPIO signals.
- IN- pins must go to ESP32 GND / common GND.
- Adapter +12V goes only to MOSFET central 正.
- Adapter GND goes to MOSFET central 负 and ESP32 GND.
- Never connect 5V signal directly to ESP32 GPIO.
- ESP32 GND, MOSFET central 负, and adapter 12V GND must be connected together.
