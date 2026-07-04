# MQTT Backend - Hydroponic_IoT_ESP32

The Node.js backend keeps the MQTT-to-MongoDB flow, exposes REST API endpoints, and serves Dashboard Web V1.

Data flow:

```text
ESP32 -> MQTT Broker -> Node.js Edge Server -> MongoDB
Browser Dashboard -> Node.js Edge Server REST API -> MongoDB
```

Current scope:

- Subscribe to `hydroponic/device001/sensor`
- Validate Main Firmware V3 sensor payloads
- Insert valid payloads into `sensor_logs`
- Upsert latest device status into `devices`
- Generate rule-based alerts in `alerts`
- Expose REST API endpoints
- Serve a browser dashboard with pulse-only manual pump test controls
- Publish pulse-only manual pump commands over MQTT
- Store ESP32 pump status responses in `pump_logs`
- Save manual Pump A/B calibration results in `pump_calibrations`
- Show latest Pump A/B flow rates on the dashboard
- Save one-point TDS calibration results in `tds_calibrations`
- Estimate `tdsPpm` in backend sensor logs when TDS calibration exists

Not implemented yet:

- Authentication
- Auto Dosing
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
Dashboard shows active alerts, pulse-only manual pump test controls, manual Pump A/B calibration results, and estimated TDS ppm when calibrated.

## Manual Pump Test

Dashboard Manual Pump Test sends pulse-only commands through the backend:

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

- Commands are pulse-only.
- Indefinite ON commands are not supported.
- Allowed pump values are `main`, `A`, and `B`.
- `spare` is not allowed from dashboard/API in this phase.
- Max duration is 10000 ms for main pump and 5000 ms for Pump A/B.
- Pump A/B commands are rejected when water level is low.
- Pump A/B commands are rejected when water temperature sensor is invalid.
- Pump A and Pump B must never run at the same time.

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

## TDS Calibration

TDS Calibration V1 stores a simple one-point voltage-factor calibration.
The ESP32 continues publishing raw TDS ADC and voltage. The backend estimates TDS ppm when a calibration exists.

Formula:

```text
tdsPpm = tdsVoltage * calibrationFactor
calibrationFactor = referenceTdsPpm / measuredVoltage
```

Example:

```text
measuredVoltage = 2.280 V
referenceTdsPpm = 900 ppm
calibrationFactor = 900 / 2.280 = 394.736 ppm/V
```

Dashboard workflow:

1. Put the TDS probe into solution.
2. Wait for TDS voltage to stabilize.
3. Read reference ppm using an external TDS meter.
4. Click `Use Latest Sensor Values` to fill raw ADC, voltage, and water temperature.
5. Enter the external reference ppm and optional note.
6. Save TDS calibration.
7. Confirm future `sensor_logs` include `tdsPpm`.

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
  "method": "one_point_voltage_factor",
  "note": "external TDS meter reference"
}
```

TDS Calibration V1 notes:

- This is one-point calibration for the current thesis prototype.
- `tdsPpm` is estimated by the backend, not by ESP32 firmware.
- Raw sensor payloads remain unchanged.
- Auto Dosing is still not implemented.

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
- `POST http://localhost:3001/api/devices/device001/pump-calibration`
- `http://localhost:3001/api/devices/device001/pump-calibrations/latest`
- `http://localhost:3001/api/devices/device001/pump-calibrations/A?limit=10`
- `http://localhost:3001/api/devices/device001/pump-calibrations/B?limit=10`
- `POST http://localhost:3001/api/devices/device001/tds-calibration`
- `http://localhost:3001/api/devices/device001/tds-calibrations/latest`
- `http://localhost:3001/api/devices/device001/tds-calibrations?limit=10`

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
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration -H "Content-Type: application/json" -d "{\"measuredRaw\":2828,\"measuredVoltage\":2.279,\"referenceTdsPpm\":900,\"waterTemp\":29.63,\"method\":\"one_point_voltage_factor\",\"note\":\"external TDS meter reference\"}"
```

Latest TDS calibration:

```powershell
curl http://localhost:3001/api/devices/device001/tds-calibrations/latest
```

TDS calibration history:

```powershell
curl "http://localhost:3001/api/devices/device001/tds-calibrations?limit=10"
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
db.devices.find()
```
