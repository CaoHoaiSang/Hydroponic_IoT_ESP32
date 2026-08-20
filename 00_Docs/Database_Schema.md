# Database Schema - Phase 22A Fix 1

## `devices`

Unique key: `deviceId`.

Important fields: `deviceId`, `status`, `lastSeenAt`, `activeTdsCalibrationSetId`,
`latestCalibration`, `latest`, `createdAt`, and `updatedAt`.

`telemetrySession` stores the accepted boot, latest accepted sequence/measurement,
one unconfirmed boot candidate, the retired-boot list, and a CAS revision.

`latest.receivedAt` is the server receipt time. `latest.measurementAt` is derived from a
same-boot uptime anchor and is accompanied by `measurementFreshnessVerified`,
`measurementTimeSource`, and `measurementAgeAtReceiptMs`. Receive time alone never proves
freshness. The first row without an anchor is fail-closed for control.
`latest` contains the complete EC/TDS measurement quality contract documented in
`Payload_Format.md`, plus water level, temperature, pump state, pH placeholder, and uptime.
Phase 23D also persists the duty-cycle acquisition snapshot: `ecProbePowerMode`,
`ecProbePowered`, `ecProbeState`, `ecProbeWarmupMs`, `ecProbePoweredAtUptimeMs`, and
`ecProbeMeasurementTrigger`. These fields describe the captured measurement, not the relay's
current electrical state after publication.

## `tds_calibration_sets`

Fields: `setId`, `deviceId`, `status` (`draft|active|retired`),
`method=piecewise_linear_ec`, `referenceScale=500`, `tdsFactor=0.5`,
`temperatureReferenceC=25`, `temperatureAlphaPerC=0.02`, point count, validation
status/errors/warnings, voltage/EC/TDS ranges, meter, note, lifecycle history, `activeLock`
for the current active set, and timestamps.

Indexes: unique `setId`; `{deviceId, status, createdAt}`; unique partial
`{deviceId, activeLock}` where `activeLock=true`.

## `tds_calibrations`

New points contain `calibrationSetId`, `deviceId`, raw/voltage/voltage25, reference EC,
derived scale-500 TDS, temperature compensation fields, method, note, and creation time.
Legacy rows may omit these fields and are never selected for control.

Index: `{deviceId, calibrationSetId, measuredVoltage25}`. It is intentionally non-unique
for compatibility; service validation rejects duplicates before activation.

## Measurements And Operation

- `sensor_logs`: sensor history with firmware identity, order classification, explicit
  `receivedAt`/`measurementAt`, and the complete quality contract. Only accepted V2
  measurements can update latest or stability. Duplicate receipts update audit metadata
  on the original row instead of creating a second row. Fix 1 adds a recoverable
  `processingState` lifecycle (`PROCESSING|FAILED|COMPLETED`) and a 30-second lease so a
  processing failure does not permanently trap the measurement as a duplicate.
- `pump_logs`: MQTT pump command/status history.
- `pump_calibrations`: measured Pump A/B flow rates.
- `auto_dosing_settings`: disabled-by-default settings, `cropCode=cai_ngot`, and
  `targetRangeConfirmed=false` until explicit operator confirmation.
- `dosing_runs`: Pump A -> Pump B -> mixing-wait workflow and outcomes. New active runs
  carry `activeLock=true` and `tdsCalibrationSetIdAtStart`; completion/failure removes the lock.
  A unique partial `{deviceId, activeLock}` index prevents two new active runs per device.
- `auto_dosing_events`: throttled safety/evaluation audit history.
- `alerts`: active/resolved hardware and data-quality alerts.
- `nutrient_response_tests`: supervised prototype response records.
- `shadow_dosing_decisions`: one side-effect-free Shadow result per accepted V2
  measurement, including engine/schema versions, 30 gates, stable reason codes,
  hypothetical action, and optional hypothetical values.

## Phase 22A Indexes

```javascript
{ deviceId: 1, measurementId: 1 } // unique, partial: schemaVersion=2 and telemetryIdentityValid=true
{ deviceId: 1, bootId: 1, telemetryOrderStatus: 1, receivedAt: -1 }
{ deviceId: 1, measurementId: 1 } // unique on shadow_dosing_decisions
{ deviceId: 1, createdAt: -1 }    // shadow history
```

No data migration is required. Legacy rows are not assigned synthetic identity and are
not made control-eligible.
