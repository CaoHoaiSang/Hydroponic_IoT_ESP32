# Hydroponic_IoT_ESP32

Smart hydroponic IoT prototype for **cải ngọt**, using ESP32, SEN0244 EC/TDS sensing,
DS18B20 water temperature, water-level interlocks, MQTT, a local Edge Server, and MongoDB.

## Current Phase

Phase 23B network transition is in progress. The Stage 1 firmware now uses a nonblocking Wi-Fi
retry state machine: one connection attempt may run for 30 seconds, then the STA is reset and
allowed to settle for one second before credentials are applied again. Disconnect reason codes
are printed for diagnosis. Source preflight, full backend regression (219/219), and a clean
`USB_STAGE1` compile pass. The first target access point was reachable but its WPA handshake
timed out at the ESP32, so the final runtime verification is waiting for the nearer previously
verified hotspot. Auto Dosing and every actuator path remain locked OFF.

Phase 23A is complete and hardens the verified Phase 22B baseline for repeatable local demonstrations. The
launcher now requires API, MongoDB, and MQTT health before reporting ready. The Dashboard
distinguishes fresh, stale, and unavailable device data and remains fail-closed through an
outage/recovery cycle. Stage 0 gains isolated EJSON backup/restore and a read-only demo readiness
checker. Auto Dosing remains locked OFF and no actuator path is added.

Phase 22B prototype integration and safety validation is complete. The physical ESP32 ran the
`USB_STAGE1` actuator-locked profile, published authenticated Telemetry Identity V2 data to the
isolated staging stack, and displayed live sensor data on the HydroFlow dashboard. The active
EC-first calibration matched the handheld meter within about -0.4% at the verified comparison
point. A formal 30-minute soak passed 60 contiguous measurements with one boot, no sequence
gap, and zero pump command or dosing-run activity.

The bounded Stage 2 Main Pump test passed with one supervised 1000 ms pulse. The ESP32 was then
restored to `USB_STAGE1`, where MQTT/Serial actuator paths are disabled and pump outputs are
forced OFF. Pump A/B hardware, MQTT pulse control, pump calibration, and the sequential A then B
clean-water Auto Dosing workflow had already passed earlier project phases. The optional Stage 3
profile was compiled and safety-tested but was not uploaded or physically rerun; the operator
accepted the prior physical evidence and closed the duplicate test path.

HydroFlow Local UI Integration is part of this baseline. The React 19 + Vite dashboard lives in
`03_Edge_Server/frontend`, is served by Express after a production build, and reads the existing
Backend APIs. Actuator controls remain fail-closed. Auto Dosing remains locked OFF and the new UI
has no enable path.

No additional generic multi-hour soak is required before continuing development. Multi-day
sensor/load observation remains a future prerequisite only before considering unattended
automatic dosing; it is not a current development gate.

Phase 21 hardens EC/TDS calibration and Auto Dosing safety. Calibration is EC-first,
uses explicit `draft -> active -> retired` sets, and converts EC to TDS with scale 500
(`tdsPpm = ecUsCm * 0.5`). Auto Dosing is disabled by default and fails closed unless
the active set, measurement quality, pump calibration, water state, main pump, target
range, and daily limit are all ready.

At its historical checkpoint, Phase 21 Fix Round 1 closed the independent-audit safety findings in source: backend
rechecks the firmware 30-sample robust-window contract with a 50-count retained-spread limit
and an 80-count absolute hard cap, accepted measurements have
an explicit `measurementAt`, post-mixing completion requires data newer than `mixingUntil`,
new active runs and Pump B publication are atomically claimed, and calibration lifecycle
writes use MongoDB transactions when supported with checked fallback rollback. Behavioral
tests passed, while runtime was still unverified at that checkpoint. Phase 22B later supplied
the isolated and physical runtime evidence summarized above.

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
- `03_Edge_Server/frontend/`: HydroFlow React/Vite local dashboard and browser acceptance tests
- `04_Database/`: database schema and sample sensor payload
- `05_Calibration_Data/`: raw calibration records for supervised work

## Start Safely

1. Read `00_Docs/Wiring_Checklist.md` and `00_Docs/EC_TDS_Calibration.md`.
2. Keep pumps and nutrient bottles disconnected; Stage 0 does not upload firmware.
3. Configure examples without committing credentials.
4. In `03_Edge_Server/mqtt_backend`, run `npm test` before `npm start`.
5. Keep Auto Dosing OFF. Phase 22A rejects attempts to enable it.

## HydroFlow Local Dashboard

Frontend-only mode keeps every actuator locked and is useful for reviewing the interface:

```powershell
cd 03_Edge_Server\frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. For the integrated production build, run
`START_FULL_LOCAL.bat` or build the frontend and start the Backend; Express serves the SPA at
the Backend port. See `README_HYDROFLOW_LOCAL.md` for the capability contract, supported API
features, verification commands, and read-only areas.

On Windows, `START_FULL_LOCAL.bat` now performs a local service/dependency/port preflight,
repairs incomplete dependencies, builds the frontend, waits for Backend health, and then opens
`http://127.0.0.1:3001/overview`. It pins MongoDB and MQTT to loopback and forces the local
fail-closed actuator profile.

## Phase 22B Stage 0

Stage 0 uses MongoDB `127.0.0.1:27018`, MQTT `127.0.0.1:18884`, database
`hydroponic_stage0`, and backend/Dashboard `127.0.0.1:3100`. Existing services on default
ports `27017` and `1883` are not used.

```powershell
cd 03_Edge_Server\mqtt_backend
powershell -ExecutionPolicy Bypass -File .\staging\Start-Staging.ps1
npm run stage0:test
powershell -ExecutionPolicy Bypass -File .\staging\Stop-Staging.ps1
powershell -ExecutionPolicy Bypass -File .\staging\Reset-Staging.ps1
```

See `03_Edge_Server/mqtt_backend/staging/README.md` for the isolation contract, topics,
repeatable lifecycle commands, and executable Stage 0 coverage.

## Phase 22B Stage 1 Preflight

Stage 1 uses MongoDB `127.0.0.1:27019`, backend/Dashboard `127.0.0.1:3101`, and authenticated
MQTT on `127.0.0.1:18885` plus the selected private LAN IPv4 on port `18885`. The generated
broker runtime config, credentials, data, logs, and `SecretsStage1.h` are ignored by Git.

```powershell
cd 03_Edge_Server\mqtt_backend\staging\stage1
.\Start-Stage1-Preflight.ps1
node .\runStage1PreflightChecks.js
.\Get-Stage1-Status.ps1
.\Stop-Stage1-Preflight.ps1
.\Reset-Stage1-Preflight.ps1
```

Set `STAGE1_WIFI_SSID` and `STAGE1_WIFI_PASSWORD` only in the current process before start
when preparing a physical Stage 1 flash. Do not commit or report their values.

See `00_Docs/Telemetry_Identity_Shadow_Mode.md` for the V2 payload, boot transition,
duplicate/order policy, Shadow gates, indexes, and read-only APIs.

Legacy TDS points remain viewable but are never selected for control automatically.
