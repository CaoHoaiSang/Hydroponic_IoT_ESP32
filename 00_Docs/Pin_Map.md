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
| DFRobot Gravity Analog TDS Sensor SEN0244 | AOUT | GPIO34 | Analog input only; module output specification is 0-2.3V |
| SEN0244 5V power relay | IN | GPIO32 | Active HIGH; external 10k ohm pull-down to GND keeps relay OFF during boot |
| DS18B20 waterproof temperature sensor | DATA | GPIO4 | Requires 4.7k ohm pull-up resistor to 3.3V |
| Water level float switch | Signal wire | GPIO27 | Other wire goes to Common GND |

## Sensor Power Wiring

| Sensor | Sensor Pin | ESP32 Connection | Notes |
|---|---|---|---|
| TDS SEN0244 | VCC / `+` | Relay `NO` | Relay `COM` receives ESP32 5V; measured sensor VCC is 4.57V ON and 53.9mV OFF |
| TDS SEN0244 | GND / `-` | ESP32 GND / common GND | Required reference for AOUT |
| TDS SEN0244 | AOUT / `A` | GPIO34 | Signal output is 0-2.3V, not the 5V supply rail |
| DS18B20 | VCC | ESP32 `3V3` | DATA remains pulled up to 3.3V |
| DS18B20 | GND | ESP32 GND / common GND | Common ground |

SEN0244 reference: <https://wiki.dfrobot.com/sen0244/>.

## SEN0244 Power Relay Wiring

The verified prototype uses a BLK Mini 1-channel 5V relay with an
`SRD-05VDC-SL-C` relay and the trigger jumper in the HIGH position.

| Relay connection | Destination |
|---|---|
| `VCC` | ESP32 5V |
| `GND` | ESP32 GND |
| `IN` | GPIO32 |
| 10k ohm resistor | Between `IN` and relay GND |
| `COM` | ESP32 5V |
| `NO` | SEN0244 VCC |
| `NC` | Not connected |

GPIO32 LOW means sensor power OFF. GPIO32 HIGH means sensor power ON. The T09 physical test
passed bounded 2-second and 10-second switching, default OFF, LED operation, and contact voltage.
SEN0244 AOUT remains connected directly to GPIO34 and SEN0244 GND remains on common GND.

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

| MOSFET Channel | ESP32 GPIO Signal | MOSFET Input + | MOSFET Input - | Load |
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

## Current Pump Output Wiring

T06 passed with the main circulation pump controlled by MOSFET CH1.

The main pump now includes an external DC PWM speed controller with a knob after MOSFET OUT1:

| MOSFET Output | Next Device | Final Load |
|---|---|---|
| OUT1+ / OUT1- | DC PWM speed controller IN+ / IN- | Main circulation pump through controller OUT+ / OUT- |
| OUT2+ / OUT2- | Pump A + / - | Pump A direct test output |
| OUT3+ / OUT3- | Pump B + / - | Pump B direct test output |
| OUT4+ / OUT4- | Spare output | Not used yet |

The DC PWM speed controller is hardware-only in the current phase. ESP32 still only controls main pump ON/OFF through GPIO25 and MOSFET CH1. Speed feedback or software speed control is not implemented.

Do not place the speed controller before the MOSFET module power input. The speed controller must not affect Pump A or Pump B.

## Pump Mapping

| Pump | Voltage | Controlled By | ESP32 GPIO | MOSFET Input | Output Wiring |
|---|---|---|---|---|---|
| Main circulation pump | 12V DC | MOSFET CH1 | GPIO25 | IN1+ | OUT1 -> DC PWM speed controller -> main pump |
| Peristaltic pump A | 12V DC | MOSFET CH2 | GPIO26 | IN2+ | OUT2 -> Pump A |
| Peristaltic pump B | 12V DC | MOSFET CH3 | GPIO14 | IN3+ | OUT3 -> Pump B |

## Safety Notes

- Do not connect pump power directly to ESP32.
- Do not connect +12V to any ESP32 GPIO.
- Do not connect the MOSFET central 正 terminal to ESP32.
- ESP32 only controls IN+ pins with GPIO signals.
- IN- pins must go to ESP32 GND / common GND.
- Adapter +12V goes only to MOSFET central 正.
- Adapter GND goes to MOSFET central 负 and ESP32 GND.
- Main pump speed knob is hardware-only; ESP32 does not measure or control speed in software.
- Use clean water only for Pump A/B testing before nutrient dosing calibration.
- Never connect 5V signal directly to ESP32 GPIO.
- SEN0244 `VCC -> 5V` is a power connection, not a GPIO signal connection. Only SEN0244
  `AOUT` may connect to GPIO34, and the official AOUT range is 0-2.3V.
- GPIO32 controls only the relay input. Never connect SEN0244 VCC or relay 5V directly to GPIO32.
- The relay must use `COM -> 5V`, `NO -> SEN0244 VCC`, and HIGH-trigger mode so the external
  10k ohm pull-down keeps sensor power OFF during boot/reset.
- Deposits and trapped air bubbles on the TDS probe can cause a large reading drift. Rinse and
  inspect the probe, remove bubbles, and wait for stable readings before calibration or dosing.
- Do not recalibrate while the probe is fouled, bubbly, outside the calibration range, or
  producing `tdsControlValid=false`.
- ESP32 GND, MOSFET central 负, and adapter 12V GND must be connected together.
