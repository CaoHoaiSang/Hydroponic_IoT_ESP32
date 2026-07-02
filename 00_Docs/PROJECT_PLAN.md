# Project Plan - Hydroponic_IoT_ESP32

## A. Project Objective

Hydroponic_IoT_ESP32 is a smart hydroponic system for Green Oakleaf lettuce / xà lách sồi xanh 932.

The current phase focuses on sensor reading, pump control, MQTT data transmission, and database logging.

## B. Current Phase Scope

### Included

| Area | Item |
|---|---|
| Controller | ESP32-WROOM-32U DevKitC V4 |
| Sensor | DFRobot Gravity Analog TDS Sensor SEN0244 |
| Sensor | DS18B20 waterproof water temperature sensor |
| Sensor | Water level float switch |
| Output driver | 4-channel MOSFET module for 12V DC loads |
| Pump | Main circulation pump 12V |
| Pump | Peristaltic pump A 12V |
| Pump | Peristaltic pump B 12V |
| Communication | MQTT |
| Backend | Edge Server receives MQTT data |
| Database | MongoDB Atlas long-term data storage |

### Excluded For Now

- pH sensor
- Zalo Bot
- AI Camera
- Adaptive Dosing
- Full Auto Dosing

## C. Development Phases

| Phase | Task |
|---|---|
| Phase 1 | Prepare folder structure and documentation |
| Phase 2 | T01_Blink_Serial |
| Phase 3 | T02_TDS_SEN0244_Test |
| Phase 4 | T03_DS18B20_Test |
| Phase 5 | T04_Water_Level_Float_Test |
| Phase 6 | T05_MOSFET_4CH_Test |
| Phase 7 | T06_Pump_Main_Test |
| Phase 8 | T07_Pump_A_B_Test |
| Phase 9 | T08_All_Hardware_Test |
| Phase 10 | Main ESP32 firmware |
| Phase 11 | MQTT integration |
| Phase 12 | Edge Server backend |
| Phase 13 | MongoDB Atlas logging |
| Phase 14 | Manual pump command from API/dashboard |
| Phase 15 | Basic alerts |

## D. Definition Of Done For Core Phase

Core phase is complete when:

1. ESP32 reads TDS raw ADC from GPIO34.
2. ESP32 reads water temperature from DS18B20 GPIO4.
3. ESP32 reads water level from GPIO27.
4. ESP32 controls main pump, pump A, and pump B through MOSFET.
5. ESP32 publishes sensor payload to MQTT.
6. Backend receives MQTT payload.
7. Backend stores sensor_logs in MongoDB Atlas.
8. Backend stores pump_logs.
9. Backend stores alerts.
10. The full data flow is demonstrated: sensor -> ESP32 -> MQTT -> Edge Backend -> MongoDB Atlas.
