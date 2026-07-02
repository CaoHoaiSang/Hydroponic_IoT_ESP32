# Hydroponic_IoT_ESP32

Smart hydroponic IoT project for Green Oakleaf lettuce / xà lách sồi xanh 932 using ESP32, sensors, MOSFET pump control, MQTT, Edge Server, and MongoDB Atlas.

## Current Phase

Core phase only. This phase prepares structure, documentation, and placeholders for step-by-step development.

No real firmware, sensor reading, pump control, MQTT backend logic, dashboard, pH sensor, Zalo Bot, AI Camera, Adaptive Dosing, or full Auto Dosing has been implemented yet.

## Hardware List

- ESP32-WROOM-32U DevKitC V4
- DFRobot Gravity Analog TDS Sensor SEN0244
- DS18B20 waterproof water temperature sensor
- Water level float switch
- 4-channel MOSFET module for 12V DC loads
- Main circulation pump 12V
- Peristaltic pump A 12V
- Peristaltic pump B 12V
- 12V adapter for pumps
- MongoDB Atlas for long-term storage
- Edge Server for MQTT receive and data logging

## Folder Structure

```text
Hydroponic_IoT_ESP32/
├── 00_Docs/
├── 01_ESP32_Test_Sketches/
├── 02_ESP32_Main_Firmware/
├── 03_Edge_Server/
├── 04_Database/
├── 05_Calibration_Data/
└── 99_Backup/
```

## How To Start

1. Read `00_Docs/PROJECT_PLAN.md`.
2. Confirm wiring using `00_Docs/Pin_Map.md` and `00_Docs/Wiring_Checklist.md`.
3. Open each Arduino sketch from its matching folder name.
4. Implement and test one small sketch at a time.
5. Record every completed change in `00_Docs/PROJECT_STATUS_REPORT.md`.

## Next Task

Implement `T01_Blink_Serial.ino` and test ESP32 Serial Monitor.
