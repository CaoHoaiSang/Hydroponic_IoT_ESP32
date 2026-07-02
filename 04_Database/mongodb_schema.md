# MongoDB Schema - Hydroponic_IoT_ESP32

This file mirrors the core database plan in `00_Docs/Database_Schema.md`.

## Collections

| Collection | Purpose |
|---|---|
| devices | Store registered hydroponic devices and last seen status. |
| sensor_logs | Store TDS, temperature, water level, pump states, and future pH field as null for now. |
| pump_logs | Store pump actions, duration, estimated volume, and reason. |
| alerts | Store water level, sensor, and TDS alerts. |
| pump_calibrations | Optional later collection for pump A/B calibration records. |

## Current Phase Note

Only schema planning is prepared now. Backend database write logic will be implemented later.
