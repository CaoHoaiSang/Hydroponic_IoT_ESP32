# HISTORICAL SNAPSHOT — DO NOT USE FOR CURRENT PHASE 21 SAFETY LOGIC.

Any `NOT TESTED` status in this snapshot reflects the time when this package was
created. Newer historical Phase 20B/20C runtime results are recorded in the Phase
20D review package and `00_Docs/PROJECT_STATUS_REPORT.md`. This file is not Phase
21 runtime evidence and must not be used as current safety guidance.

# PHASE 20C REVIEW PACKAGE - Hydroponic_IoT_ESP32

## 1. Implementation Summary

Phase 20C adds monitoring, safety visibility, event history, controlled daily-dose reset, run-history filtering, and CSV exports around the existing Auto Dosing V2 workflow.

The working Phase 20B sequence remains unchanged:

```text
Pump A pulse -> Pump A completed -> Pump B pulse -> Pump B completed
-> mixing_wait -> next valid sensor payload after mixing delay -> run completed
```

No ESP32 firmware, GPIO pin, MQTT pump protocol, or Pump A/B pulse-only safety behavior was changed.

Confirmed Phase 20B runtime result documented in this phase:

- TDS before: 302.27 ppm
- TDS after mixing: 348.88 ppm
- Delta: +46.61 ppm
- Dose: 1 ml Pump A + 1 ml Pump B
- Mixing delay: 15 minutes

## 2. Files Changed

Created:

- `03_Edge_Server/mqtt_backend/src/services/autoDosingEventService.js`
- `03_Edge_Server/mqtt_backend/src/services/exportService.js`
- `00_Docs/PHASE_20C_REVIEW_PACKAGE.md`

Modified:

- `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js`
- `03_Edge_Server/mqtt_backend/src/validators/autoDosingSettingsValidator.js`
- `03_Edge_Server/mqtt_backend/src/mongoClient.js`
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`
- `03_Edge_Server/mqtt_backend/public/index.html`
- `03_Edge_Server/mqtt_backend/public/styles.css`
- `03_Edge_Server/mqtt_backend/public/app.js`
- `03_Edge_Server/mqtt_backend/README.md`
- `00_Docs/PROJECT_STATUS_REPORT.md`

Not modified:

- ESP32 firmware
- Pin map
- MQTT client pump-command flow
- Pump calibration logic
- TDS calibration logic
- Existing dosing records

## 3. Backend Routes Added

```text
GET  /api/devices/:deviceId/auto-dosing/events?limit=50
GET  /api/devices/:deviceId/auto-dosing/events/summary
GET  /api/devices/:deviceId/auto-dosing/daily-usage
POST /api/devices/:deviceId/auto-dosing/daily-usage/reset
GET  /api/devices/:deviceId/export/dosing-runs.csv
GET  /api/devices/:deviceId/export/nutrient-response-tests.csv
GET  /api/devices/:deviceId/export/auto-dosing-events.csv
```

Daily reset requires:

```json
{
  "confirmText": "RESET DAILY DOSE",
  "reason": "prototype_test_session"
}
```

An incorrect confirmation returns HTTP 400 and does not create a reset event.

## 4. MongoDB Collections and Indexes

New collection:

```text
auto_dosing_events
```

Indexes:

```javascript
{ deviceId: 1, createdAt: -1 }
{ eventId: 1 } unique
{ deviceId: 1, eventType: 1, reason: 1, createdAt: -1 }
```

Existing collections are reused:

- `auto_dosing_settings`
- `dosing_runs`
- `nutrient_response_tests`
- `pump_logs`
- `devices`
- `pump_calibrations`

No records are deleted by Phase 20C.

## 5. Dashboard Changes

Auto Dosing Safety Summary now shows:

- Mode and enabled state
- Current safety state
- Current TDS and target range
- Last evaluation reason, time, and TDS
- Main pump and water level
- Require-main-pump setting
- Pump A/B calibration readiness

Daily Dose Usage shows:

- Used, maximum, and remaining ml per pump
- Progress percentage
- Calculation-window start
- Last reset time
- Counted runs
- Limit-reached warning
- Controlled reset button

Run monitoring shows:

- Detailed active run state and mixing countdown
- Latest completed V2 run and result label
- Expected +20 to +40 ppm range note
- V1 legacy and V2 closed-loop labels
- Run filters for all, V2, V1, active/mixing, and completed

Event monitoring shows:

- Time, type, reason, TDS, main pump, water level, daily usage, and message
- Filters for all, skip, run, safety, and settings
- 24-hour summary

Export Data provides three CSV download links.

The existing Auto Dosing form edit guard remains active during the 5-second dashboard refresh.

## 6. Daily Dose Calculation and Reset Logic

Normal calculation window:

```text
local server day start -> current time
```

After a same-day manual reset:

```text
latest manual_daily_reset createdAt -> current time
```

Counted runs:

- Same device
- Created inside the calculation window
- Status is `in_progress`, `mixing_wait`, or `completed`
- Uses `stepDoseMlPerPump`, with legacy `doseMlPerPump` fallback

Reset behavior:

- Requires exact confirmation text.
- Creates a `manual_daily_reset` event.
- Does not delete or edit `dosing_runs`.
- Does not delete or edit `pump_logs`.
- Does not enable Auto Dosing.
- Does not remove nutrient physically added to the reservoir.

## 7. Event Logging and Throttling

Important transition events:

- `settings_updated`
- `run_started`
- `pump_a_completed`
- `pump_b_completed`
- `mixing_wait_started`
- `run_completed`
- `daily_limit_reached`
- `manual_daily_reset`

Evaluation and safety reasons include:

- `disabled`
- `main_pump_not_running`
- `water_level_low`
- `water_temp_invalid`
- `tds_ppm_missing`
- `tds_unstable`
- `pump_calibration_missing`
- `dosing_run_active`
- `mixing_wait_active`
- `daily_dose_limit_reached`
- `above_target_range`
- `within_target_range`
- Duration and pump-command failures

Deduplication:

- Repeated `evaluation`, `skip`, and `daily_limit_reached` events are logged when type/reason changes.
- An unchanged repeated event is logged again after 5 minutes by default.
- The interval can be configured with `AUTO_DOSING_EVENT_DEDUP_MS`.
- Transition event logging is monitoring-only and is guarded so a logging failure does not interrupt the working dosing sequence.
- Manual reset requires a successfully stored reset event because that event defines the new calculation window.

## 8. Export API

CSV exports use fixed field lists and RFC-style quote escaping for commas, quotes, and line breaks.

Exports:

- `dosing_runs`
- `nutrient_response_tests`
- `auto_dosing_events`

Documents are filtered by `deviceId` and sorted newest first.

No external CSV library was added.

## 9. Documentation Updates

Updated:

- `03_Edge_Server/mqtt_backend/README.md`
- `00_Docs/PROJECT_STATUS_REPORT.md`

Documentation now includes:

- Phase 20B runtime PASS summary
- Real nutrient one-step result
- Phase 20C routes and dashboard behavior
- Event-log purpose and throttle
- Daily-reset warning
- CSV exports
- Recommended conservative settings
- Phase 20C runtime status

No credentials, MongoDB URI, Wi-Fi password, `.env` values, or API keys are included.

## 10. Static Checks Run

PASS:

- `node --check` for all JavaScript files in backend `src/` and `public/`
- Dashboard DOM check: 216 `byId()` references, zero missing IDs
- HTML ID check: 197 IDs, zero duplicates
- Validator accepts the conservative safe settings
- Validator rejects mixing delay below 60000 ms
- Validator rejects per-run maximum above daily maximum
- Validator rejects step dose above per-run maximum
- Validator rejects invalid target min/max range
- `git diff --check` completed without whitespace errors
- ESP32 firmware path has no Phase 20C modifications

Backend HTTP runtime was not started automatically because reconnecting MQTT while real hardware may be online could trigger enabled Auto Dosing. This avoids unintended pump operation.

## 11. Runtime Test Checklist and Results

1. Dashboard loads new monitoring cards: **NOT TESTED**
2. Auto Dosing settings save and edit guard: **NOT TESTED**
3. Disabled event dedup/throttle: **NOT TESTED**
4. Main pump OFF safety and no Pump A/B publish: **NOT TESTED**
5. Daily usage used/max/remaining/limit warning: **NOT TESTED**
6. Exact-confirmation reset, no record deletion, reset event: **NOT TESTED**
7. Existing Auto Dosing V2 one-step sequence after Phase 20C: **NOT TESTED**
8. Three CSV downloads: **NOT TESTED**
9. V1 legacy and V2 closed-loop run filters: **NOT TESTED**
10. Auto Dosing OFF after all tests: **NOT TESTED**

Recommended runtime order:

1. Start MongoDB, Mosquitto, ESP32 V3, and backend with Auto Dosing OFF.
2. Verify monitoring cards and CSV downloads first.
3. Verify disabled and main-pump-OFF event throttling.
4. Test reset only in a controlled prototype session.
5. Run one clean-water step with a 1-minute test delay.
6. Confirm Pump A -> Pump B -> `mixing_wait` -> completed.
7. Turn Auto Dosing OFF when finished.
