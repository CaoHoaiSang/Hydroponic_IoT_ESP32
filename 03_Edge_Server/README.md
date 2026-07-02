# Edge Server - Hydroponic_IoT_ESP32

This folder contains Edge Server planning and placeholders for the core phase.

## Current Scope

- Receive MQTT sensor payloads from ESP32.
- Validate payloads against the documented JSON format.
- Store sensor_logs, pump_logs, and alerts in MongoDB Atlas.
- Prepare for later dashboard/API reads.

## Not Implemented Yet

- Real MQTT connection code
- Real MongoDB Atlas writes
- Dashboard/API endpoints
- Zalo Bot
- AI Camera
- Adaptive Dosing
- Full Auto Dosing

## Next Backend Step

After ESP32 MQTT publishing is verified, implement the mqtt_backend service step by step.
