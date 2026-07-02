# MQTT Topics - Hydroponic_IoT_ESP32

## Confirmed Topics

| No. | Topic | Direction | Purpose |
|---|---|---|---|
| 1 | hydroponic/device001/sensor | ESP32 -> Backend | Send TDS, temperature, water level, and pump states. |
| 2 | hydroponic/device001/pump/cmd | Backend -> ESP32 | Manual pump commands. |
| 3 | hydroponic/device001/pump/status | ESP32 -> Backend | Pump execution status. |
| 4 | hydroponic/device001/alert | ESP32/Backend -> DB/Dashboard | Water level low, sensor error, TDS abnormal. |

## Notes

- Device ID for this phase is `device001`.
- MQTT payloads must match `00_Docs/Payload_Format.md`.
- Full Auto Dosing is reserved for a later phase.
