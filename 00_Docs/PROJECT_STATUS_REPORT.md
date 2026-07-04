# PROJECT STATUS REPORT - Hydroponic_IoT_ESP32

## 1. Last Updated

- Date: 2026-07-04
- Updated by: Codex

## 2. Current Project Phase

- Current phase: Phase 18 - TDS Calibration V1
- Short description: Pump Calibration V1 runtime test passed. TDS Calibration V1 is implemented in the backend/dashboard using one-point voltage-factor calibration to estimate `tdsPpm`.

## 3. Completed Tasks

| No. | Task | Status | Notes |
|---|---|---|---|
| 1 | T01 through T08 local hardware tests | Done | Passed. |
| 2 | Main Firmware Local V1 | Done | Passed. |
| 3 | Main Firmware V2 Wi-Fi + MQTT sensor publish | Done | Passed. |
| 4 | Edge Server V1 MQTT subscriber to MongoDB | Done | Passed. |
| 5 | Backend REST API V1 | Done | Passed. |
| 6 | Dashboard Web V1 runtime test | Done | Passed. |
| 7 | Alert & Data Quality V1 runtime test | Done | Passed. |
| 8 | MQTT Pump Command V1 | Done | Passed. Pulse-only manual pump command flow verified. |
| 9 | MQTT Pump Command V1 runtime test | Done | Passed. ESP32 V3 subscribed to pump/cmd, backend subscribed to pump/status, Pulse Main/A/B passed, `pump_logs` started/completed inserted, and Pump A/B rejected when water level was low. |
| 10 | Pump Calibration V1 | Done | Passed. |
| 11 | Pump Calibration V1 runtime test | Done | Passed. Dashboard section OK, Pump A save OK, Pump B save OK, MongoDB insert OK, and `devices.latestCalibration` update OK. |
| 12 | Pump A calibration | Done | Passed. Latest flow rate: 2.000 ml/s from 5000 ms and 10 ml. |
| 13 | Pump B calibration | Done | Passed. Latest flow rate: 1.800 ml/s from 5000 ms and 9 ml. |
| 14 | TDS Calibration V1 | Done | Implemented. |
| 15 | TDS Calibration V1 runtime test | Waiting for user test | Use external TDS meter/reference solution, save calibration, then verify `tds_calibrations`, `devices.latestTdsCalibration`, and future `sensor_logs.tdsPpm`. |

## 4. Created Folders

No new folders were created for Phase 18.

## 5. Created Files

Phase 18:

- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js`

Previous phases:

- `03_Edge_Server/mqtt_backend/src/validators/pumpCalibrationValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/pumpCalibrationService.js`
- `03_Edge_Server/mqtt_backend/src/validators/pumpCommandValidator.js`
- `03_Edge_Server/mqtt_backend/src/services/pumpCommandService.js`
- `03_Edge_Server/mqtt_backend/src/services/pumpLogService.js`

## 6. Modified Files

Phase 18:

- `00_Docs/PROJECT_STATUS_REPORT.md`
- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`
- `03_Edge_Server/mqtt_backend/README.md`
- `03_Edge_Server/mqtt_backend/public/index.html`
- `03_Edge_Server/mqtt_backend/public/styles.css`
- `03_Edge_Server/mqtt_backend/public/app.js`

No ESP32 firmware files were modified in Phase 18.

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
| `hydroponic/device001/sensor` | ESP32 -> Backend | Sensor/status data | Passed |
| `hydroponic/device001/pump/cmd` | Backend -> ESP32 | Pulse-only manual pump command | Passed |
| `hydroponic/device001/pump/status` | ESP32 -> Backend | Pump accepted/rejected/started/completed/cancelled status | Passed |
| `hydroponic/device001/alert` | Backend/DB/Dashboard | Alerts | MongoDB/dashboard alerts implemented |

## 9. Current Code Status

- Dashboard Web V1 runtime test: Passed.
- Alert & Data Quality V1 runtime test: Passed.
- MQTT Pump Command V1 runtime test: Passed.
- Pump Calibration V1 runtime test: Passed.
- Pump A calibration: Passed, 2.000 ml/s.
- Pump B calibration: Passed, 1.800 ml/s.
- TDS Calibration V1: Implemented.
- TDS Calibration V1 runtime test: Waiting for user test.
- Backend creates index for MongoDB `tds_calibrations`.
- Backend exposes `POST /api/devices/:deviceId/tds-calibration`.
- Backend exposes `GET /api/devices/:deviceId/tds-calibrations/latest`.
- Backend exposes `GET /api/devices/:deviceId/tds-calibrations?limit=20`.
- Backend applies latest TDS calibration to future sensor payloads and stores `tdsPpm`, `tdsCalibrationFactorUsed`, and `tdsCalibrationId` in `sensor_logs`.
- Backend updates `devices.latest.tdsPpm`, `devices.latest.tdsCalibrationFactorUsed`, and `devices.latest.tdsCalibrationId`.
- Backend updates `devices.latestTdsCalibration` when a calibration is saved.
- Dashboard shows TDS PPM in Latest Device Status.
- Dashboard has a separate TDS Calibration section with latest sensor fill, save calibration, latest calibration display, and latest 10 history rows.
- ESP32 firmware continues publishing raw TDS values only. Backend estimates calibrated ppm.

## 10. Known Issues

- TDS calibration is one-point voltage-factor prototype calibration.
- TDS Calibration V1 runtime test has not been performed yet.
- Auto Dosing not implemented yet.
- Adaptive Dosing not implemented yet.
- pH remains `null`.
- No authentication yet.

## 11. Next Recommended Task

Use an external TDS meter/reference solution to enter referenceTdsPpm, save TDS calibration, verify tds_calibrations collection, verify devices.latestTdsCalibration, and verify future sensor_logs include tdsPpm.

## 12. Notes for ChatGPT Web

Pump Calibration V1 passed runtime testing: Pump A saved calibration and displays 2.000 ml/s, Pump B saved calibration and displays 1.800 ml/s, MongoDB `pump_calibrations` insert worked, and `devices.latestCalibration` updated. Phase 18 TDS Calibration V1 was implemented without changing ESP32 firmware. The backend now stores one-point TDS calibration records in MongoDB `tds_calibrations`, calculates `calibrationFactor = referenceTdsPpm / measuredVoltage`, applies latest calibration to future sensor payloads, stores estimated `tdsPpm` in `sensor_logs` and `devices.latest`, and dashboard shows TDS PPM plus a TDS Calibration section. Auto Dosing and Adaptive Dosing are still not implemented.
