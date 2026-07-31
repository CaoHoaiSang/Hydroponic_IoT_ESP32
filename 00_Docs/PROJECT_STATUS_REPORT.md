# PROJECT STATUS REPORT - Hydroponic_IoT_ESP32

## 1. Last Updated

- Date: 2026-07-29
- Updated by: Codex

## 2. Current Project Phase

- Current phase: Phase 20B - Nutrient Response Logging + Auto Dosing V2 Closed-loop Step Dosing + Main Pump Continuous Control
- Short description: Phase 20B is implemented in the existing ESP32 firmware, local Node.js backend, MongoDB-backed services, and dashboard. Runtime hardware testing is still required.

## 3. Completed Tasks

| No. | Task | Status | Notes |
|---|---|---|---|
| 1 | T01 through T08 local hardware tests | Done | Passed. |
| 2 | Main Firmware V2 Wi-Fi + MQTT sensor publish | Done | Passed. |
| 3 | Edge Server MQTT to MongoDB | Done | Passed. |
| 4 | Dashboard Web V1 | Done | Passed. |
| 5 | Alert & Data Quality V1 | Done | Passed. |
| 6 | MQTT Pump Command V1 | Done | Passed. |
| 7 | Pump Calibration V1 | Done | Passed. Pump A = 2.000 ml/s, Pump B = 1.800 ml/s. |
| 8 | TDS Calibration V2.1 | Done | Passed for prototype use. |
| 9 | Auto Dosing V1 clean-water safety test | Done | Passed. |
| 10 | Phase 19B Dashboard Form Edit Guard | Done | Implemented. |
| 11 | Main pump continuous ON/OFF control | Done | Implemented for main pump only. Runtime test waiting. |
| 12 | Nutrient Response Logging | Done | Implemented. Runtime test waiting. |
| 13 | Auto Dosing V2 closed-loop step dosing | Done | Implemented. Runtime test waiting. |
| 14 | Dashboard Phase 20B UI | Done | Implemented. Runtime test waiting. |

## 4. Created Folders

No new folders were created for Phase 20B.

## 5. Created Files

Phase 20B:

- `03_Edge_Server/mqtt_backend/src/validators/nutrientResponseTestValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/nutrientResponseService.js`

## 6. Modified Files

Phase 20B:

- `00_Docs/PROJECT_STATUS_REPORT.md`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.h`
- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp`
- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
- `03_Edge_Server/mqtt_backend/src/mqttClient.js`
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`
- `03_Edge_Server/mqtt_backend/src/validators/pumpCommandValidator.js`
- `03_Edge_Server/mqtt_backend/src/validators/autoDosingSettingsValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js`
- `03_Edge_Server/mqtt_backend/src/services/pumpLogService.js`
- `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js`
- `03_Edge_Server/mqtt_backend/public/index.html`
- `03_Edge_Server/mqtt_backend/public/styles.css`
- `03_Edge_Server/mqtt_backend/public/app.js`
- `03_Edge_Server/mqtt_backend/README.md`

## 7. Hardware Pin Map Confirmed

| Function | GPIO | Status |
|---|---|---|
| TDS SEN0244 AOUT | GPIO34 | Confirmed |
| DS18B20 DATA | GPIO4 | Confirmed |
| Water level float switch | GPIO27 | Confirmed |
| Pump Main / MOSFET CH1 IN1+ | GPIO25 | Confirmed |
| Pump A / MOSFET CH2 IN2+ | GPIO26 | Confirmed |
| Pump B / MOSFET CH3 IN3+ | GPIO14 | Confirmed |
| Spare / MOSFET CH4 IN4+ | GPIO33 | Confirmed |

## 8. MQTT Topics Confirmed

| Topic | Direction | Purpose | Current Status |
|---|---|---|---|
| `hydroponic/device001/sensor` | ESP32 -> Backend | Sensor/status data | Existing flow preserved |
| `hydroponic/device001/pump/cmd` | Backend -> ESP32 | Pulse commands and main pump set on/off | Extended in Phase 20B |
| `hydroponic/device001/pump/status` | ESP32 -> Backend | Pump started/completed/rejected/set_on/set_off status | Extended in Phase 20B |
| `hydroponic/device001/alert` | Backend/DB/Dashboard | Alerts | Existing flow preserved |

## 9. Current Code Status

- Main pump continuous control: Implemented for `pump=main`, `action=set`, `state=on/off`.
- Pump A/B continuous control: Not allowed; A/B remain pulse-only.
- Main pump ON backend validation: allowed only when latest water level is `normal`.
- Main pump OFF backend validation: always allowed.
- ESP32 firmware accepts `action=set` only for main pump and publishes `set_on` / `set_off` pump status.
- `pump_logs` accepts and stores pulse status plus set status.
- Nutrient Response Logging: Implemented with `nutrient_response_tests`, backend-calculated averages, deltas, and ppm-per-pair estimate.
- Nutrient Response dashboard: Implemented with latest test, summary, history, and fill-from-latest-logs buttons.
- Auto Dosing V2: Implemented as closed-loop step dosing.
- Auto Dosing V2 default: disabled.
- Auto Dosing V2 dosing step: Pump A pulse first, then Pump B pulse, then `mixing_wait`.
- Auto Dosing V2 completion: after `mixingUntil`, next valid sensor payload completes the run with `tdsPpmAfterMixing` and `deltaTdsPpm`.
- Auto Dosing V2 safety: checks water level, water temperature validity, optional `tdsStable`, main pump ON requirement, Pump A/B calibration, active run, mixing wait, duration limits, and daily dose limit.
- Dashboard Auto Dosing form edit guard: preserved.
- Hybrid Local-first alignment: dosing logic runs locally on the Hydroponic Edge AI Gateway / Local Control Server represented by the local Node.js backend + MQTT broker + dashboard.
- MongoDB remains in use for this prototype.

## 10. Known Issues

- Phase 20B runtime test has not been performed yet.
- Auto Dosing V2 is rule-based closed-loop step dosing, not Adaptive Dosing.
- Use clean water first before connecting nutrient bottles.
- `tdsStable` is optional and currently only checked if present.
- Auto Dosing does not auto-start the main pump in this phase.
- pH remains `null`.
- No authentication yet.
- No SQLite/PostgreSQL migration.
- No Fleet Management Cloud, Device Enrollment, AI Model OTA, Zalo OA, or AI Camera.

## 11. Next Recommended Task

Run MongoDB, Mosquitto, ESP32 firmware, and backend. Open dashboard and perform the Phase 20B runtime checklist:

1. Confirm existing sensor publish still works.
2. Confirm existing pump pulse still works for main, Pump A, and Pump B.
3. Turn Main Pump ON from dashboard and verify ESP32 keeps it ON, publishes `set_on`, backend stores `pump_logs`, and dashboard shows ON.
4. Turn Main Pump OFF and verify ESP32 publishes `set_off`, backend stores `pump_logs`, and dashboard shows OFF.
5. Reject invalid continuous control by publishing Pump A/B `action=set` test payloads and confirming rejection.
6. Save a Nutrient Response Test and verify backend averages/deltas, MongoDB `nutrient_response_tests`, dashboard latest result, history, and summary.
7. Confirm Auto Dosing V2 disabled gives reason `disabled` and publishes no pump command.
8. Confirm Auto Dosing V2 safety: main pump OFF with `requireMainPumpOn=true` gives `main_pump_not_running`; low water gives `water_level_low`.
9. Clean-water Auto Dosing V2 test: set main pump ON, temporarily set `mixingDelayMs=60000`, enable targetMin above current TDS, verify Pump A then Pump B, run enters `mixing_wait`, no second run during mixing wait, then next sensor payload after delay completes run with `tdsPpmAfterMixing` and `deltaTdsPpm`.
10. Disable Auto Dosing after test.

## 12. Notes for ChatGPT Web

Phase 20B is implemented without recreating the project structure or migrating the database. Main pump continuous ON/OFF was added only for the main circulation pump; Pump A/B remain pulse-only. Nutrient Response Logging was added for experimental records and does not run pumps. Auto Dosing was upgraded to V2 closed-loop step dosing: one small Pump A/B step, wait `mixingDelayMs`, then re-check TDS on the next sensor payload. The dosing logic remains local-first on the Hydroponic Edge AI Gateway / Local Control Server. Runtime testing is still required before using nutrient bottles.
