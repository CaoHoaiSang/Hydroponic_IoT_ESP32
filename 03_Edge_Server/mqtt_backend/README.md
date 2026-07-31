# MQTT Backend - Hydroponic_IoT_ESP32

The Node.js backend keeps the MQTT-to-MongoDB flow, exposes REST API endpoints, and serves Dashboard Web V1.

Data flow:

```text
ESP32 -> MQTT Broker -> Node.js Edge Server -> MongoDB
Browser Dashboard -> Node.js Edge Server REST API -> MongoDB
```

In the current prototype, the local Node.js backend + MQTT broker + dashboard represent the Hydroponic Edge AI Gateway / Local Control Server. Phase 20B keeps MongoDB and does not migrate to SQLite/PostgreSQL or Fleet Management Cloud.

Current scope:

- Subscribe to `hydroponic/device001/sensor`
- Validate Main Firmware V3 sensor payloads
- Insert valid payloads into `sensor_logs`
- Upsert latest device status into `devices`
- Generate rule-based alerts in `alerts`
- Expose REST API endpoints
- Serve a browser dashboard with pulse test controls and main pump continuous control
- Publish pulse-only Pump A/B commands and main pump set on/off commands over MQTT
- Store ESP32 pump status responses in `pump_logs`
- Save manual Pump A/B calibration results in `pump_calibrations`
- Show latest Pump A/B flow rates on the dashboard
- Save TDS calibration points in `tds_calibrations`
- Estimate `tdsPpm` in backend sensor logs when TDS calibration exists
- Store Nutrient Response Test records in `nutrient_response_tests`
- Run Auto Dosing V2 as disabled-by-default closed-loop step dosing

Not implemented yet:

- Authentication
- Adaptive Dosing
- pH sensor logic

## 1. Install Dependencies

```powershell
npm install
```

## 2. Copy Environment File

```powershell
copy .env.example .env
```

## 3. Configure `.env`

Set these values for your machine:

- `HTTP_PORT`
- `CORS_ORIGIN`
- `MQTT_URL`
- `MONGO_URI`
- `MONGO_DB_NAME`

Use `MQTT_URL=mqtt://127.0.0.1:1883` if Mosquitto runs on the same laptop.

## 4. Start Services

1. Start MongoDB.
2. Start Mosquitto.
3. Upload and keep ESP32 Main Firmware V3 running.
4. Start backend with `npm start`.
5. Open `http://localhost:3001/`.

Expected startup output:

```text
Hydroponic MQTT Backend starting...
Service: hydroponic-mqtt-backend
MongoDB connected
MongoDB indexes ensured
MQTT connected
Subscribed to hydroponic/device001/sensor
REST API listening on http://localhost:3001
Dashboard available at http://localhost:3001/
```

## Dashboard

Dashboard URL:

```text
http://localhost:3001/
```

Dashboard monitoring data refreshes every 5 seconds.
Dashboard shows active alerts, main pump continuous control, pulse test controls, manual Pump A/B calibration results, estimated TDS ppm when calibrated, Nutrient Response Tests, and Auto Dosing V2 settings/status.

## Manual Pump Test

Dashboard Manual Pump Test sends timed pulse commands through the backend:

```text
Dashboard/API -> Backend REST API -> MQTT pump/cmd -> ESP32 -> MQTT pump/status -> Backend -> MongoDB pump_logs
```

MQTT pump command topic:

```text
hydroponic/device001/pump/cmd
```

ESP32 Main Firmware V3 subscribes to this topic.

MQTT pump status topic:

```text
hydroponic/device001/pump/status
```

ESP32 Main Firmware V3 publishes pump status to this topic.

REST endpoint:

```text
POST http://localhost:3001/api/devices/device001/pump-command
```

Example request body:

```json
{
  "pump": "A",
  "action": "pulse",
  "durationMs": 3000,
  "reason": "manual_dashboard"
}
```

Safety rules:

- Timed pulse commands remain available for main, Pump A, and Pump B.
- Allowed pump values are `main`, `A`, and `B`.
- `spare` is not allowed from dashboard/API in this phase.
- Max duration is 10000 ms for main pump and 5000 ms for Pump A/B.
- Pump A/B commands are rejected when water level is low.
- Pump A/B commands are rejected when water temperature sensor is invalid.
- Pump A and Pump B must never run at the same time.

## Main Pump Continuous Control

Phase 20B adds continuous ON/OFF control for the main circulation pump only.
Pump A, Pump B, and spare output do not support continuous ON/OFF from dashboard/API.

REST endpoint:

```text
POST http://localhost:3001/api/devices/device001/pumps/main/state
```

Example ON:

```json
{
  "state": "on"
}
```

Example OFF:

```json
{
  "state": "off"
}
```

MQTT command payload:

```json
{
  "commandId": "cmd_...",
  "deviceId": "device001",
  "pump": "main",
  "action": "set",
  "state": "on",
  "source": "dashboard"
}
```

Safety rules:

- Main pump ON is allowed only when latest water level is `normal`.
- Main pump OFF is always allowed.
- Pump A/B remain pulse-only for safety.
- Main pump should be ON during mixing, Nutrient Response Tests, and Auto Dosing V2.
- Main pump continuous ON does not block later Pump A/B pulse commands.

## Pump Calibration

Pump Calibration V1 stores manual flow-rate measurements for Pump A and Pump B.
It uses the existing Manual Pump Test pulse command to run the pump, then the user enters the measured output volume.

Dashboard workflow:

1. Use clean water only.
2. Place the pump outlet into a measuring cup or graduated cylinder.
3. Run Pulse A or Pulse B from Manual Pump Test with a fixed duration.
4. Measure the output volume in ml.
5. Enter pump, duration ms, measured ml, and optional note.
6. Save calibration.
7. Check latest Pump A/B flow rate and the calibration history table.

Backend calculation:

```text
flowRateMlPerSec = measuredMl / (durationMs / 1000)
```

REST endpoints:

```text
POST http://localhost:3001/api/devices/device001/pump-calibration
GET  http://localhost:3001/api/devices/device001/pump-calibrations/latest
GET  http://localhost:3001/api/devices/device001/pump-calibrations/A?limit=10
GET  http://localhost:3001/api/devices/device001/pump-calibrations/B?limit=10
```

Example calibration request:

```json
{
  "pump": "A",
  "durationMs": 5000,
  "measuredMl": 12.5,
  "method": "manual_graduated_cup",
  "note": "clean water test"
}
```

Calibration safety notes:

- Use clean water for calibration.
- Do not use nutrient bottles during calibration.
- Measure output manually with a measuring cup or graduated cylinder.
- Calibration only stores flow rate data.
- Calibration does not enable Auto Dosing.

## Nutrient Response Logging

Phase 20B adds `nutrient_response_tests` for logging experimental nutrient response data.
This API does not publish pump commands and does not run pumps.

Nutrient Response Test 2-4 summary:

- Working level: 16L
- TDS sensor supply: 5V
- Main pump: ON
- Auto Dosing: OFF
- Dose: Pump A 1 ml + Pump B 1 ml
- Pump A duration: 500 ms
- Pump B duration: 556 ms
- Final mixing time used for stable result: 15 minutes
- Estimated response: about +20 to +40 ppm per 1 ml A + 1 ml B pair

REST endpoints:

```text
POST http://localhost:3001/api/devices/device001/nutrient-response-tests
GET  http://localhost:3001/api/devices/device001/nutrient-response-tests?limit=20
GET  http://localhost:3001/api/devices/device001/nutrient-response-tests/latest
GET  http://localhost:3001/api/devices/device001/nutrient-response-summary
```

Backend calculations:

- `before.dashboardAverage` from before dashboard values.
- `after15min.dashboardAverage` from after 15 minute dashboard values.
- `result.deltaDashboard`.
- `result.deltaPenMain`.
- `result.deltaPenSecondary`.
- `result.estimatedResponsePpmPerMl` as ppm increase per 1 ml A + 1 ml B pair.

## Auto Dosing V2

Auto Dosing V2 is a disabled-by-default, rule-based closed-loop step dosing workflow.
It is disabled by default and must be explicitly enabled from the dashboard or API.
Dashboard auto-refresh does not overwrite unsaved Auto Dosing form edits.
Press `Save Settings` to apply Auto Dosing setting changes.

Data flow:

```text
New sensor payload -> Backend evaluates tdsPpm/settings/safety -> MQTT pump/cmd Pump A -> ESP32 -> MQTT pump/status -> MQTT pump/cmd Pump B -> ESP32 -> MQTT pump/status -> mixing_wait -> next sensor payload after mixingDelay -> MongoDB dosing_runs completed
```

Auto Dosing V2 uses:

- `tdsPpm` from TDS calibration.
- Pump A/B flow rates from Pump Calibration V1.
- Existing MQTT Pump Command V1.
- ESP32 Main Firmware with main pump set command support.
- Closed-loop small step dosing.
- Nutrient response estimate for operator visibility.

It does not:

- Directly control GPIO or pumps.
- Send indefinite ON commands.
- Auto-start the main pump.
- Implement Adaptive Dosing.
- Implement pH dosing.
- Implement large one-shot dosing.

Safety rules:

- Auto Dosing is disabled by default.
- Test with clean water before using nutrient bottles.
- Dosing only runs when `enabled=true`.
- Dosing only runs when water level is `normal`.
- Dosing only runs when water temperature sensor is valid.
- If `tdsStable` exists and is false, dosing is skipped.
- If `requireMainPumpOn=true`, dosing only runs when main pump is ON.
- Dosing only runs when `tdsPpm < targetMinPpm`.
- If `tdsPpm` is within range, no pump command is sent.
- If `tdsPpm > targetMaxPpm`, no pump command is sent.
- Pump A and Pump B calibration must both exist.
- Pump durations must be within the existing Pump Command V1 limit of 5000 ms for Pump A/B.
- Pump A runs first. Pump B only runs after Pump A completes successfully.
- After Pump B completes, the run enters `mixing_wait`.
- No new dosing starts during `mixing_wait`.
- After `mixingDelayMs`, the next valid sensor payload completes the run with `tdsPpmAfterMixing` and `deltaTdsPpm`.
- Daily dose limit is enforced before starting a new step.

Default settings:

```json
{
  "mode": "closed_loop_step",
  "enabled": false,
  "targetMinPpm": 800,
  "targetMaxPpm": 1200,
  "stepDoseMlPerPump": 1.0,
  "mixingDelayMs": 900000,
  "maxDoseMlPerPumpPerRun": 1.0,
  "maxDailyDoseMlPerPump": 10.0,
  "requireMainPumpOn": true,
  "responseEstimatePpmPerMl": 30,
  "responseEstimateWorkingLevelLiters": 16
}
```

Duration calculation:

```text
durationMsA = round((stepDoseMlPerPump / pumpAFlowRateMlPerSec) * 1000)
durationMsB = round((stepDoseMlPerPump / pumpBFlowRateMlPerSec) * 1000)
```

Example with clean water:

```text
Pump A = 2.000 ml/s
Pump B = 1.800 ml/s
stepDoseMlPerPump = 1.0 ml

durationMsA = 500 ms
durationMsB = 556 ms
```

REST endpoints:

```text
GET http://localhost:3001/api/devices/device001/auto-dosing/settings
PUT http://localhost:3001/api/devices/device001/auto-dosing/settings
GET http://localhost:3001/api/devices/device001/auto-dosing/runs?limit=20
GET http://localhost:3001/api/devices/device001/auto-dosing/active-run
```

Example settings update:

```json
{
  "mode": "closed_loop_step",
  "enabled": false,
  "targetMinPpm": 800,
  "targetMaxPpm": 1200,
  "stepDoseMlPerPump": 1,
  "mixingDelayMs": 900000,
  "maxDoseMlPerPumpPerRun": 1,
  "maxDailyDoseMlPerPump": 10,
  "requireMainPumpOn": true,
  "responseEstimatePpmPerMl": 30,
  "responseEstimateWorkingLevelLiters": 16
}
```

For a clean-water test, keep nutrient bottles disconnected, set main pump ON, temporarily set `mixingDelayMs=60000`, and set `targetMinPpm` above the current `tdsPpm` to trigger one safe closed-loop step.

## TDS Calibration

TDS Calibration V1 used a simple one-point voltage-factor calibration.
Runtime testing showed that one-point calibration matched the external TDS meter at the calibration point, but was not accurate after dilution.

TDS Calibration V2 keeps each saved record as one calibration point and uses multiple points when available.
TDS Calibration V2.1 adds temperature compensation because TDS/EC depends on water temperature.
The ESP32 continues publishing raw TDS ADC and voltage. The backend estimates TDS ppm from stored calibration points.
The backend uses DS18B20 `waterTemp` to normalize TDS voltage to 25 C before calibration and runtime estimation.

Temperature compensation formula:

```text
temperatureCoefficient = 1 + 0.02 * (waterTemp - 25)
voltage25 = voltage / temperatureCoefficient
```

One-point fallback formula:

```text
tdsPpm = voltage25 * calibrationFactor
calibrationFactor = referenceTdsPpm / measuredVoltage25
```

Piecewise linear formula between two temperature-compensated calibration points:

```text
slope = (ppm2 - ppm1) / (voltage25_2 - voltage25_1)
intercept = ppm1 - slope * voltage25_1
tdsPpm = slope * currentVoltage25 + intercept
```

Rules:

- No calibration points: `tdsPpm = null`.
- One calibration point: backend falls back to one-point voltage-factor mode and shows `one_point_calibration_only`.
- Two or more calibration points: backend sorts points by `measuredVoltage25` and uses piecewise linear interpolation.
- If current `voltage25` is outside the calibrated range, backend extrapolates from the nearest two points and marks the result out of range.
- If water temperature is missing, backend falls back to raw voltage and shows `water_temp_missing_for_tds_compensation`.
- Estimated `tdsPpm` is clamped to a minimum of 0.

Example:

```text
measuredVoltage = 2.280 V
waterTemp = 29.63 C
temperatureCoefficient = 1 + 0.02 * (29.63 - 25) = 1.0926
measuredVoltage25 = 2.280 / 1.0926 = 2.087 V
referenceTdsPpm = 900 ppm
calibrationFactor = 900 / 2.087 = 431.241 ppm/V
```

For better accuracy, clear old incorrect calibration points if needed and save at least two fresh temperature-compensated calibration points:

1. Low ppm point.
2. High ppm point.

Dashboard workflow:

1. Put the TDS probe into solution.
2. Wait for TDS voltage to stabilize.
3. Use ppm mode on the external TDS meter.
4. Click `Use Latest Sensor Values` to fill raw ADC, voltage, and water temperature.
5. Enter the external reference ppm and optional note.
6. Save TDS calibration point.
7. Repeat for at least one low ppm point and one high ppm point.
8. Confirm future `sensor_logs` include `tdsPpm`, calibration mode, point count, in-range status, and warning when applicable.

REST endpoints:

```text
POST http://localhost:3001/api/devices/device001/tds-calibration
GET  http://localhost:3001/api/devices/device001/tds-calibrations/latest
GET  http://localhost:3001/api/devices/device001/tds-calibrations?limit=10
```

Example TDS calibration request:

```json
{
  "measuredRaw": 2828,
  "measuredVoltage": 2.279,
  "referenceTdsPpm": 900,
  "waterTemp": 29.63,
  "method": "multi_point_piecewise_linear",
  "note": "external TDS meter reference"
}
```

TDS Calibration V2.1 notes:

- Old one-point calibration records are kept and reused as calibration points.
- Old calibration points without temperature compensation may affect results.
- Fresh low/high calibration points are recommended after enabling temperature compensation.
- `tdsPpm` is estimated by the backend, not by ESP32 firmware.
- Raw sensor payloads remain unchanged.
- Auto Dosing V2 is implemented for closed-loop clean-water safety testing.
- Adaptive Dosing is still not implemented.

## Alerts

Alerts are generated from incoming sensor payloads. Raw `sensor_logs` are not modified.

Alert & Data Quality V1 supports:

- `water_level_low`
- `water_temp_invalid`
- `tds_sensor_anomaly`

## REST API URLs

- `http://localhost:3001/health`
- `http://localhost:3001/api/devices/device001/latest`
- `http://localhost:3001/api/devices/device001/sensor-logs?limit=20`
- `http://localhost:3001/api/alerts/active`
- `http://localhost:3001/api/alerts/latest?limit=20`
- `http://localhost:3001/api/devices/device001/alerts?status=active&limit=20`
- `POST http://localhost:3001/api/devices/device001/pump-command`
- `POST http://localhost:3001/api/devices/device001/pumps/main/state`
- `POST http://localhost:3001/api/devices/device001/pump-calibration`
- `http://localhost:3001/api/devices/device001/pump-calibrations/latest`
- `http://localhost:3001/api/devices/device001/pump-calibrations/A?limit=10`
- `http://localhost:3001/api/devices/device001/pump-calibrations/B?limit=10`
- `POST http://localhost:3001/api/devices/device001/tds-calibration`
- `http://localhost:3001/api/devices/device001/tds-calibrations/latest`
- `http://localhost:3001/api/devices/device001/tds-calibrations?limit=10`
- `POST http://localhost:3001/api/devices/device001/nutrient-response-tests`
- `http://localhost:3001/api/devices/device001/nutrient-response-tests?limit=20`
- `http://localhost:3001/api/devices/device001/nutrient-response-tests/latest`
- `http://localhost:3001/api/devices/device001/nutrient-response-summary`
- `http://localhost:3001/api/devices/device001/auto-dosing/settings`
- `PUT http://localhost:3001/api/devices/device001/auto-dosing/settings`
- `http://localhost:3001/api/devices/device001/auto-dosing/runs?limit=20`
- `http://localhost:3001/api/devices/device001/auto-dosing/active-run`

## REST API Test Commands

Health:

```powershell
curl http://localhost:3001/health
```

List devices:

```powershell
curl http://localhost:3001/api/devices
```

Device detail:

```powershell
curl http://localhost:3001/api/devices/device001
```

Device latest:

```powershell
curl http://localhost:3001/api/devices/device001/latest
```

Device sensor logs:

```powershell
curl "http://localhost:3001/api/devices/device001/sensor-logs?limit=5"
```

Latest sensor logs:

```powershell
curl "http://localhost:3001/api/sensor-logs/latest?limit=5"
```

Active alerts:

```powershell
curl http://localhost:3001/api/alerts/active
```

Latest alerts:

```powershell
curl "http://localhost:3001/api/alerts/latest?limit=20"
```

Device alerts:

```powershell
curl "http://localhost:3001/api/devices/device001/alerts?status=active&limit=20"
```

Manual pump command:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/pump-command -H "Content-Type: application/json" -d "{\"pump\":\"A\",\"action\":\"pulse\",\"durationMs\":3000,\"reason\":\"manual_dashboard\"}"
```

Turn main pump ON continuously:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/pumps/main/state -H "Content-Type: application/json" -d "{\"state\":\"on\"}"
```

Turn main pump OFF:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/pumps/main/state -H "Content-Type: application/json" -d "{\"state\":\"off\"}"
```

Save Pump A calibration:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/pump-calibration -H "Content-Type: application/json" -d "{\"pump\":\"A\",\"durationMs\":5000,\"measuredMl\":12.5,\"method\":\"manual_graduated_cup\",\"note\":\"clean water test\"}"
```

Latest pump calibrations:

```powershell
curl http://localhost:3001/api/devices/device001/pump-calibrations/latest
```

Pump A calibration history:

```powershell
curl "http://localhost:3001/api/devices/device001/pump-calibrations/A?limit=10"
```

Save TDS calibration:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration -H "Content-Type: application/json" -d "{\"measuredRaw\":2828,\"measuredVoltage\":2.279,\"referenceTdsPpm\":900,\"waterTemp\":29.63,\"method\":\"multi_point_piecewise_linear\",\"note\":\"external TDS meter reference\"}"
```

Latest TDS calibration:

```powershell
curl http://localhost:3001/api/devices/device001/tds-calibrations/latest
```

TDS calibration history:

```powershell
curl "http://localhost:3001/api/devices/device001/tds-calibrations?limit=10"
```

Save nutrient response test:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/nutrient-response-tests -H "Content-Type: application/json" -d "{\"workingLevelLiters\":16,\"tdsSensorSupply\":\"5V\",\"mainPumpOn\":true,\"autoDosingEnabled\":false,\"before\":{\"dashboardValues\":[754,758,756],\"penMainPpm\":775,\"waterTempSensor\":29.7,\"waterLevel\":\"normal\"},\"dose\":{\"pumpAMl\":1,\"pumpBml\":1,\"pumpADurationMs\":500,\"pumpBDurationMs\":556,\"pumpACompleted\":true,\"pumpBCompleted\":true},\"after15min\":{\"dashboardValues\":[785,790,788],\"penMainPpm\":806,\"waterTempSensor\":29.8},\"result\":{\"mixingTimeUsedMin\":15},\"note\":\"16L response test\"}"
```

Nutrient response summary:

```powershell
curl http://localhost:3001/api/devices/device001/nutrient-response-summary
```

Auto dosing settings:

```powershell
curl http://localhost:3001/api/devices/device001/auto-dosing/settings
```

Update auto dosing settings:

```powershell
curl -X PUT http://localhost:3001/api/devices/device001/auto-dosing/settings -H "Content-Type: application/json" -d "{\"mode\":\"closed_loop_step\",\"enabled\":false,\"targetMinPpm\":800,\"targetMaxPpm\":1200,\"stepDoseMlPerPump\":1,\"mixingDelayMs\":900000,\"maxDoseMlPerPumpPerRun\":1,\"maxDailyDoseMlPerPump\":10,\"requireMainPumpOn\":true,\"responseEstimatePpmPerMl\":30,\"responseEstimateWorkingLevelLiters\":16}"
```

Auto dosing active run:

```powershell
curl http://localhost:3001/api/devices/device001/auto-dosing/active-run
```

Auto dosing run history:

```powershell
curl "http://localhost:3001/api/devices/device001/auto-dosing/runs?limit=10"
```

## Optional Manual MQTT Publish Test

```powershell
mosquitto_pub -h localhost -t hydroponic/device001/sensor -m "{\"deviceId\":\"device001\",\"tdsRaw\":2832,\"tdsVoltage\":2.282,\"tdsMin\":2826,\"tdsMax\":2849,\"waterTemp\":29.69,\"waterTempValid\":true,\"waterLevel\":\"normal\",\"pumpMain\":false,\"pumpA\":false,\"pumpB\":false,\"pumpSpare\":false,\"ph\":null,\"uptimeMs\":30053}"
```

## Check MongoDB

Use `mongosh`:

```javascript
use hydroponic_iot
db.sensor_logs.find().sort({ createdAt: -1 }).limit(5)
db.pump_calibrations.find().sort({ createdAt: -1 }).limit(5)
db.tds_calibrations.find().sort({ createdAt: -1 }).limit(5)
db.nutrient_response_tests.find().sort({ createdAt: -1 }).limit(5)
db.auto_dosing_settings.find()
db.dosing_runs.find().sort({ createdAt: -1 }).limit(5)
db.devices.find()
```
