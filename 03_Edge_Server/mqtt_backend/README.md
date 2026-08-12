# MQTT Backend - Hydroponic_IoT_ESP32

The Node.js backend keeps the MQTT-to-MongoDB flow, exposes REST API endpoints, and serves Dashboard Web V1.

Data flow:

```text
ESP32 -> MQTT Broker -> Node.js Edge Server -> MongoDB
Browser Dashboard -> Node.js Edge Server REST API -> MongoDB
```

## Phase 22A Fix 1 Telemetry Identity And Shadow Mode

Phase 22A compiles the ESP32 firmware with Telemetry Identity V2 and adds conservative
backend ordering. Every new firmware measurement has `schemaVersion=2`, a boot-scoped
`bootId`, increasing `measurementSeq`, derived `measurementId`, and
`sampledAtUptimeMs`. MQTT retries reuse the exact same identity and payload.

The backend rejects incomplete V2 identity, handles duplicate identity idempotently,
excludes out-of-order and unconfirmed-boot packets from latest/stability/control, and
requires three distinct accepted measurements from one boot for stability. Legacy
payloads remain visible in history as `LEGACY_NO_IDENTITY` but are control-ineligible.

Fix 1 does not use `receivedAt` as proof of freshness. It derives `measurementAt` from
the prior same-boot uptime anchor. The first unanchored row and impossible uptime timing
remain control-ineligible. Sensor rows also use `PROCESSING|FAILED|COMPLETED` plus a
30-second lease so retry can resume a failed/stuck row without creating a duplicate.

Shadow Mode is configured independently:

```text
SHADOW_MODE_ENABLED=false
```

Set it to `true` only when observation records are wanted. Shadow Mode evaluates 30
safety gates and saves hypothetical decisions to `shadow_dosing_decisions`. It has no
MQTT publisher dependency, never creates `dosing_runs`, and never operates a pump.
Daily-dose gate input comes from the same Phase 21 `getDailyDoseUsage()` function,
including manual reset windows and active runs.

Phase 22A locks Auto Dosing OFF at runtime and disables its dashboard enable checkbox.
Attempts to save `enabled=true` return HTTP 409 with
`phase22a_auto_dosing_locked_off`. The existing Pump A -> Pump B -> mixing-wait code is
retained for regression coverage but is not reachable from production telemetry in this phase.

Read-only Shadow APIs:

```text
GET /api/devices/:deviceId/shadow-mode/status
GET /api/devices/:deviceId/shadow-mode/decisions?limit=20
```

No Phase 22A migration assigns identity to legacy rows. No production database or MQTT
broker was used during implementation.

## Phase 21 EC/TDS Safety Contract

The current demo crop is **cải ngọt**. Existing target numbers are not treated as a
verified cải ngọt nutrient profile. Auto Dosing defaults to OFF and cannot be enabled
until the operator explicitly confirms the target range for cải ngọt and all readiness
checks pass.

Phase 21 changes calibration to EC-first:

```text
ADC median -> voltage -> voltage25 -> active EC calibration set
-> in-range EC interpolation -> TDS scale 500 -> quality/stability gate
```

- Scale is fixed to `500`; `tdsFactor=0.5`.
- Calibration sets use `draft -> active -> retired` and need at least three valid points.
- Only `devices.activeTdsCalibrationSetId` is used for control.
- Active sets are immutable and legacy points are never activated automatically.
- Outside the active voltage range, `ecUsCm` and `tdsPpm` are null; no extrapolation is used.
- Firmware sends 30-sample median quality fields; backend requires three stable payloads.
- Backend independently enforces `tdsWindowStable === (tdsSampleCount === 30 && tdsSpreadRaw <= 50)`.
- Accepted sensor rows and `devices.latest` contain explicit `receivedAt` and uptime-derived
  `measurementAt`; unverified timing fails closed.
- Post-mixing completion requires `measurementAt > mixingUntil` and the same still-active calibration set used at run start.
- Unique partial active locks plus atomic Pump B claim prevent concurrent runs and duplicate Pump B publication.
- Calibration activation/retirement uses MongoDB transactions when supported and checked compensating rollback otherwise.
- Firmware and backend Phase 21 must be upgraded together.

Calibration-set endpoints:

```text
POST /api/devices/:deviceId/tds-calibration-sets
GET  /api/devices/:deviceId/tds-calibration-sets
GET  /api/devices/:deviceId/tds-calibration-sets/active
GET  /api/devices/:deviceId/tds-calibration-sets/:setId
POST /api/devices/:deviceId/tds-calibration-sets/:setId/points
POST /api/devices/:deviceId/tds-calibration-sets/:setId/validate
POST /api/devices/:deviceId/tds-calibration-sets/:setId/activate
POST /api/devices/:deviceId/tds-calibration-sets/:setId/retire
GET  /api/devices/:deviceId/auto-dosing/readiness
```

Legacy audit migration defaults to dry-run:

```powershell
node scripts/migrateLegacyTdsCalibrations.js
# Only after reviewing the report:
node scripts/migrateLegacyTdsCalibrations.js --apply
```

The scan includes all rows and uses the same persisted-point completeness helper as
calibration-set activation. It checks device/set identity, ADC/voltage consistency,
EC and scale-500 TDS consistency, water temperature, 25 C compensation metadata,
compensated voltage, factor/reference constants, and the EC interpolation method.
`reasonCounts` reports every incomplete metadata group. Dry-run performs no writes.
Apply mode only writes `legacy`, `legacyReasons`, and `legacyAuditedAt`; it never fills
missing calibration values, infers scale 500, changes lifecycle status, or activates a set.

The Phase 21 implementation and tests do not start MQTT, send pump commands, activate a
set, or connect to the operational database.

In the current prototype, the local Node.js backend + MQTT broker + dashboard represent the Hydroponic Edge AI Gateway / Local Control Server. Phase 20C keeps MongoDB and does not migrate to SQLite/PostgreSQL or Fleet Management Cloud.

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
- Store throttled Auto Dosing evaluation and transition history in `auto_dosing_events`
- Show daily dose usage and a controlled prototype reset
- Export dosing, nutrient response, and Auto Dosing event data as CSV

## Phase 20B/20C Runtime Status

Phase 20B and Phase 20C passed supervised runtime prototype validation.

Runtime-verified features:

- Main circulation pump continuous ON/OFF from the dashboard.
- Main, Pump A, and Pump B pulse commands remain functional.
- Pump A/B continuous `set/on` commands are rejected; Pump A/B remain pulse-only.
- Pump status and `pump_logs` record `set_on`, `set_off`, pulse start, and pulse completion.
- Nutrient Response Test records are stored and backend averages/deltas are calculated correctly.
- Auto Dosing V2 disabled safety prevents new dosing runs.
- The main-pump-OFF interlock prevents Pump A/B commands when `requireMainPumpOn=true`.
- Auto Dosing V2 performs one conservative Pump A step, then Pump B, then `mixing_wait`, then completes after the next eligible sensor payload.
- Daily dose limit stops additional dosing.
- Auto Dosing Safety Summary, Daily Dose Usage, Active Run, Latest Completed Run, V1/V2 history, and Event Log display correctly.
- Dosing runs, nutrient response tests, and Auto Dosing events CSV exports download with data.

Important safety warning:

> Auto Dosing must remain disabled by default. Enable only during supervised tests or controlled operation.

Recommended safe operating settings:

```text
stepDoseMlPerPump = 1
maxDoseMlPerPumpPerRun = 1
maxDailyDoseMlPerPump = 1 or 2 during prototype testing
mixingDelayMs = 900000 for real nutrient operation
requireMainPumpOn = true
```

Main pump continuous ON may be used for circulation and mixing. Pump A/B must remain pulse-only. Large one-shot dosing is not permitted.

Runtime Nutrient Response Test 4:

| Measurement | Before | After 15 minutes | Delta |
|---|---:|---:|---:|
| Dashboard average | 406.23 ppm | 427.28 ppm | +21.05 ppm |
| Main handheld pen | 535 ppm | 573 ppm | +38 ppm |
| Secondary handheld pen | 449 ppm | 462 ppm | +13 ppm |

Test conditions: 16 L working level, TDS sensor supply 5V, main pump ON, Auto Dosing OFF, 1 ml Pump A + 1 ml Pump B, 15-minute mixing time.

Runtime real-nutrient Auto Dosing V2 result:

| Field | Result |
|---|---|
| Mode | `closed_loop_step` |
| Status | `completed` |
| TDS at start | 302.27 ppm |
| TDS after mixing | 348.88 ppm |
| Delta TDS | +46.61 ppm |
| Pump A | 1 ml, 500 ms, completed |
| Pump B | 1 ml, 556 ms, completed |
| Mixing delay | 15 minutes |
| Water level after mixing | `normal` |
| Result | `positive_response` |

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
Dashboard shows active alerts, main pump continuous control, pulse test controls, manual Pump A/B calibration results, estimated TDS ppm when calibrated, Nutrient Response Tests, and Auto Dosing V2 safety monitoring.

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

## Auto Dosing V2 (Historical Workflow, Locked OFF In Phase 22A)

Auto Dosing V2 is a disabled-by-default, rule-based closed-loop step dosing workflow.
During Phase 22A it is locked OFF and cannot be enabled from the dashboard or API.
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
- Dosing is fail-closed: `tdsStable === true` and `tdsControlValid === true` are
  both required. The firmware window must contain exactly 30 samples within the
  configured raw-spread limit, the measurement must be fresh and inside the
  active calibration-set range, temperature must be valid, and every water,
  pump, calibration, target, run, and daily-limit interlock must pass explicitly.
- If `requireMainPumpOn=true`, dosing only runs when main pump is ON.
- Dosing only runs when `tdsPpm < targetMinPpm`.
- If `tdsPpm` is within range, no pump command is sent.
- If `tdsPpm > targetMaxPpm`, no pump command is sent.
- Pump A and Pump B calibration must both exist.
- Pump durations must be within the existing Pump Command V1 limit of 5000 ms for Pump A/B.
- Pump A runs first. Pump B only runs after Pump A completes successfully.
- After Pump B completes, the run enters `mixing_wait`.
- No new dosing starts during `mixing_wait`.
- After `mixingDelayMs`, only a fresh control-valid sensor payload with
  `measurementAt > mixingUntil` from the same still-active calibration set may
  complete the run with `tdsPpmAfterMixing` and `deltaTdsPpm`.
- Daily dose limit is enforced before starting a new step.

Default settings:

```json
{
  "mode": "closed_loop_step",
  "enabled": false,
  "cropCode": "cai_ngot",
  "targetRangeConfirmed": false,
  "targetMinPpm": 800,
  "targetMaxPpm": 1200,
  "stepDoseMlPerPump": 1.0,
  "mixingDelayMs": 900000,
  "maxDoseMlPerPumpPerRun": 1.0,
  "maxDailyDoseMlPerPump": 2.0,
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
  "maxDailyDoseMlPerPump": 2,
  "requireMainPumpOn": true,
  "responseEstimatePpmPerMl": 30,
  "responseEstimateWorkingLevelLiters": 16
}
```

For a clean-water test, keep nutrient bottles disconnected, set main pump ON, temporarily set `mixingDelayMs=60000`, and set `targetMinPpm` above the current `tdsPpm` to trigger one safe closed-loop step.

## Phase 20C Monitoring and Safety Tools

Phase 20C does not change the working Phase 20B Pump A -> Pump B -> `mixing_wait` sequence.
It adds monitoring, event history, daily usage visibility, a controlled prototype reset, settings guardrails, and report exports.

Confirmed Phase 20B runtime results:

- Main pump continuous ON/OFF: passed.
- Pump A/B continuous `set` commands: rejected as required.
- Existing pulse commands: passed.
- Nutrient Response Logging: passed.
- Auto Dosing V2 disabled, main pump OFF, one-step, mixing wait, and daily limit safety: passed.

Latest real nutrient one-step result:

```text
TDS start: 302.27 ppm
TDS after 15 minutes mixing: 348.88 ppm
Delta: +46.61 ppm
Dose: 1 ml Pump A + 1 ml Pump B
```

Recommended prototype settings:

- Keep Auto Dosing OFF by default.
- `stepDoseMlPerPump = 1`
- `maxDoseMlPerPumpPerRun = 1`
- `maxDailyDoseMlPerPump = 1` or `2`
- `mixingDelayMs = 900000` for real nutrient operation.
- `requireMainPumpOn = true`

Dashboard safety behavior:

- Unsaved form edits remain protected from the 5-second refresh.
- Enabling Auto Dosing requires operator confirmation.
- Mixing delays below 15 minutes show a testing-only warning.
- Prototype and real-nutrient presets always keep `enabled=false`.
- The monitoring area shows current safety state, calibration readiness, daily usage, active run, latest completed V2 result, V1/V2 run history, and Auto Dosing events.

Auto Dosing events:

- Important run transitions and settings updates are always logged.
- Repeated skip reasons are logged when the reason changes or after the default 5-minute throttle interval.
- `lastEvaluationReason` remains in `auto_dosing_settings` for quick display.

Daily dose reset:

- Requires exact confirmation text `RESET DAILY DOSE`.
- Creates a `manual_daily_reset` event.
- Daily usage ignores runs before the latest reset timestamp on the same local day.
- It does not delete `dosing_runs` or modify `pump_logs`.
- Resetting counter does not remove nutrient physically added to reservoir.
- Reset does not enable Auto Dosing.

Phase 20C REST endpoints:

```text
GET  /api/devices/:deviceId/auto-dosing/events?limit=50
GET  /api/devices/:deviceId/auto-dosing/events/summary
GET  /api/devices/:deviceId/auto-dosing/daily-usage
POST /api/devices/:deviceId/auto-dosing/daily-usage/reset
GET  /api/devices/:deviceId/export/dosing-runs.csv
GET  /api/devices/:deviceId/export/nutrient-response-tests.csv
GET  /api/devices/:deviceId/export/auto-dosing-events.csv
```

Daily reset request:

```json
{
  "confirmText": "RESET DAILY DOSE",
  "reason": "prototype_test_session"
}
```

CSV output uses fixed field lists and escapes commas, quotes, and line breaks for report writing.

## EC/TDS Calibration - Current Phase 21 Workflow

Legacy V1-V2.1 rows are retained for labeled audit history only. Their ppm-first,
one-point/two-point, missing-temperature fallback, point-reuse, and extrapolation rules
are prohibited for Phase 21 control. Legacy rows are never mixed into a draft set and
never activated automatically.

Current rules:

- Create a new draft calibration set for each recalibration campaign.
- Use physical EC references in `referenceEcUsCm`; scale is fixed to 500 and backend
  derives `referenceTdsPpm = referenceEcUsCm * 0.5`.
- Every point requires valid raw ADC, matching voltage, and DS18B20 temperature so the
  backend can calculate `measuredVoltage25`.
- A set needs at least three distinct points with strictly increasing voltage25 and EC.
- Only draft sets accept points. Active sets are immutable.
- Validate immediately before activation. Activation retires the previous set and keeps
  Auto Dosing disabled.
- Missing temperature, an invalid set, or voltage outside the active calibrated range
  produces `ecUsCm=null`, `tdsPpm=null`, and an invalid control state. There is no fallback
  to raw voltage and no extrapolation.
- Two identical 1413 us/cm packets provide one distinct EC level, not three points.

Create a draft set:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets -H "Content-Type: application/json" -d "{\"referenceMeter\":\"external EC meter\",\"note\":\"supervised certified references\"}"
```

Add one EC reference point to the returned `<SET_ID>`:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets/<SET_ID>/points -H "Content-Type: application/json" -d "{\"measuredRaw\":1750,\"measuredVoltage\":1.410,\"waterTemp\":25.0,\"referenceEcUsCm\":1413,\"note\":\"Hanna 1413 us/cm\"}"
```

Repeat with at least two additional distinct certified EC references, then validate. Do
not activate when validation fails:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets/<SET_ID>/validate
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets/<SET_ID>/activate
```

Activation is a lifecycle operation, not permission to dose. Confirm readiness separately
and keep Auto Dosing OFF until firmware, database, dashboard, and clean-water runtime checks
have passed.

Legacy history remains available at the old GET endpoints for audit only. Legacy POST
requires an explicit `calibrationSetId` and delegates to draft-point validation; the
calibration-set point endpoint above is preferred.

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
- `POST http://localhost:3001/api/devices/device001/tds-calibration-sets`
- `http://localhost:3001/api/devices/device001/tds-calibration-sets`
- `http://localhost:3001/api/devices/device001/tds-calibration-sets/active`
- `POST http://localhost:3001/api/devices/device001/tds-calibration-sets/:setId/points`
- `POST http://localhost:3001/api/devices/device001/tds-calibration-sets/:setId/validate`
- `POST http://localhost:3001/api/devices/device001/tds-calibration-sets/:setId/activate`
- `POST http://localhost:3001/api/devices/device001/tds-calibration-sets/:setId/retire`
- `http://localhost:3001/api/devices/device001/tds-calibrations?limit=10` (legacy history only)
- `POST http://localhost:3001/api/devices/device001/nutrient-response-tests`
- `http://localhost:3001/api/devices/device001/nutrient-response-tests?limit=20`
- `http://localhost:3001/api/devices/device001/nutrient-response-tests/latest`
- `http://localhost:3001/api/devices/device001/nutrient-response-summary`
- `http://localhost:3001/api/devices/device001/auto-dosing/settings`
- `PUT http://localhost:3001/api/devices/device001/auto-dosing/settings`
- `http://localhost:3001/api/devices/device001/auto-dosing/runs?limit=20`
- `http://localhost:3001/api/devices/device001/auto-dosing/active-run`
- `http://localhost:3001/api/devices/device001/auto-dosing/events?limit=50`
- `http://localhost:3001/api/devices/device001/auto-dosing/events/summary`
- `http://localhost:3001/api/devices/device001/auto-dosing/daily-usage`
- `POST http://localhost:3001/api/devices/device001/auto-dosing/daily-usage/reset`
- `http://localhost:3001/api/devices/device001/export/dosing-runs.csv`
- `http://localhost:3001/api/devices/device001/export/nutrient-response-tests.csv`
- `http://localhost:3001/api/devices/device001/export/auto-dosing-events.csv`

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

Create a Phase 21 EC calibration set:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets -H "Content-Type: application/json" -d "{\"referenceMeter\":\"external EC meter\",\"note\":\"new supervised draft\"}"
```

Add an EC point to the returned draft set:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets/<SET_ID>/points -H "Content-Type: application/json" -d "{\"measuredRaw\":1750,\"measuredVoltage\":1.410,\"waterTemp\":25.0,\"referenceEcUsCm\":1413,\"note\":\"certified reference\"}"
```

Validate and inspect active EC calibration:

```powershell
curl -X POST http://localhost:3001/api/devices/device001/tds-calibration-sets/<SET_ID>/validate
curl http://localhost:3001/api/devices/device001/tds-calibration-sets/active
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
curl -X PUT http://localhost:3001/api/devices/device001/auto-dosing/settings -H "Content-Type: application/json" -d "{\"mode\":\"closed_loop_step\",\"enabled\":false,\"targetMinPpm\":800,\"targetMaxPpm\":1200,\"stepDoseMlPerPump\":1,\"mixingDelayMs\":900000,\"maxDoseMlPerPumpPerRun\":1,\"maxDailyDoseMlPerPump\":2,\"requireMainPumpOn\":true,\"responseEstimatePpmPerMl\":30,\"responseEstimateWorkingLevelLiters\":16}"
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
mosquitto_pub -h localhost -t hydroponic/device001/sensor -m "{\"deviceId\":\"device001\",\"tdsRaw\":2832,\"tdsVoltage\":2.282,\"tdsMin\":2826,\"tdsMax\":2849,\"tdsSampleCount\":30,\"tdsSpreadRaw\":23,\"tdsWindowStable\":true,\"waterTemp\":29.69,\"waterTempValid\":true,\"waterLevel\":\"normal\",\"pumpMain\":false,\"pumpA\":false,\"pumpB\":false,\"pumpSpare\":false,\"ph\":null,\"uptimeMs\":30053}"
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
db.auto_dosing_events.find().sort({ createdAt: -1 }).limit(20)
db.devices.find()
```
