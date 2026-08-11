# Hydroponic_IoT_ESP32

Smart hydroponic IoT prototype for **cải ngọt**, using ESP32, SEN0244 EC/TDS sensing,
DS18B20 water temperature, water-level interlocks, MQTT, a local Edge Server, and MongoDB.

## Current Phase

Phase 22A Fix 1 remediates the independent re-audit before staging. Phase 22A adds a
Telemetry Identity V2 firmware contract, backend duplicate and
order protection, three-distinct-measurement stability, and a side-effect-free Shadow
Mode. Auto Dosing is locked OFF. Shadow Mode can record hypothetical eligibility and
reason codes but cannot publish MQTT pump commands or create dosing runs.

Fix 1 prevents delayed retries from becoming fresh merely because the server received
them again, resumes failed/stuck telemetry rows safely, shares Phase 21 daily-dose
accounting with Shadow, and executes firmware-core and Dashboard rendering tests.

Firmware baseline and Phase 22A pre-Fix-1 builds passed with Arduino CLI 1.5.1, ESP32
core 3.3.10, and the verified Arduino IDE FQBN. The full firmware has not been recompiled
after Fix 1 in the current environment; the native C++ core harness passes. Isolated
backend/API/Dashboard tests pass; no
firmware upload, operational database/MQTT connection, calibration lifecycle mutation,
or physical pump operation occurred.

Phase 21 hardens EC/TDS calibration and Auto Dosing safety. Calibration is EC-first,
uses explicit `draft -> active -> retired` sets, and converts EC to TDS with scale 500
(`tdsPpm = ecUsCm * 0.5`). Auto Dosing is disabled by default and fails closed unless
the active set, measurement quality, pump calibration, water state, main pump, target
range, and daily limit are all ready.

Phase 21 Fix Round 1 closes the independent-audit safety findings in source: backend
rechecks the firmware 30-sample/50-count stability contract, accepted measurements have
an explicit `measurementAt`, post-mixing completion requires data newer than `mixingUntil`,
new active runs and Pump B publication are atomically claimed, and calibration lifecycle
writes use MongoDB transactions when supported with checked fallback rollback. Behavioral
tests pass, but operational MongoDB/MQTT, firmware, dashboard, and pump runtime remain unverified.

Phase 21 Fix Round 2 consolidates superseded review artifacts and makes migration audit
classification use the same full modern calibration-point completeness contract as set
activation. Phase 20B/20C runtime evidence is retained as historical evidence only; it
does not count as Phase 21 runtime validation. Auto Dosing remains OFF.

No pH dosing, Adaptive Dosing, Zalo Bot, AI Camera, or authentication is implemented.

## Main Hardware

- ESP32-WROOM-32U DevKitC V4
- DFRobot Gravity Analog TDS Sensor SEN0244 on GPIO34
- DS18B20 on GPIO4 with 4.7k pull-up
- Float switch on GPIO27
- Four-channel MOSFET module
- Main pump GPIO25, Pump A GPIO26, Pump B GPIO14, spare GPIO33

## Project Layout

- `00_Docs/`: plans, wiring, payload, schema, calibration, and project status
- `01_ESP32_Test_Sketches/`: hardware tests T01 through T08
- `02_ESP32_Main_Firmware/`: ESP32 firmware V3 plus Phase 21 sensor-quality fields
- `03_Edge_Server/mqtt_backend/`: MQTT backend, REST API, dashboard, tests, and migration
- `04_Database/`: database schema and sample sensor payload
- `05_Calibration_Data/`: raw calibration records for supervised work

## Start Safely

1. Read `00_Docs/Wiring_Checklist.md` and `00_Docs/EC_TDS_Calibration.md`.
2. Recompile Fix 1 with the verified FQBN before any upload; keep pumps and nutrient bottles disconnected.
3. Configure examples without committing credentials.
4. In `03_Edge_Server/mqtt_backend`, run `npm test` before `npm start`.
5. Keep Auto Dosing OFF. Phase 22A rejects attempts to enable it.

See `00_Docs/Telemetry_Identity_Shadow_Mode.md` for the V2 payload, boot transition,
duplicate/order policy, Shadow gates, indexes, and read-only APIs.

Legacy TDS points remain viewable but are never selected for control automatically.
