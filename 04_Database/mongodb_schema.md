# MongoDB Phase 22A Fix 1 Summary

Primary collections: `devices`, `sensor_logs`, `tds_calibration_sets`,
`tds_calibrations`, `pump_logs`, `pump_calibrations`, `auto_dosing_settings`,
`dosing_runs`, `auto_dosing_events`, `alerts`, and `nutrient_response_tests`.
Phase 22A adds `shadow_dosing_decisions` and Telemetry Identity V2 fields to
`sensor_logs`/`devices.latest`.

The active EC/TDS calibration is selected only through
`devices.activeTdsCalibrationSetId`. Legacy TDS points remain stored but are not active.
Accepted sensor rows and `devices.latest` store server `receivedAt` separately from an
uptime-derived `measurementAt`; unverified timing is control-ineligible. Sensor rows use
a recoverable processing state and 30-second lease so failed/stuck rows can resume.
New active calibration sets and dosing runs use unique partial `activeLock=true` indexes
per device to make lifecycle/run reservation atomic. Dosing runs also store
`tdsCalibrationSetIdAtStart` so post-mixing completion cannot switch calibration sets.
See `00_Docs/Database_Schema.md` for the complete contract and indexes.

Telemetry V2 uses a partial unique `{deviceId, measurementId}` sensor-log index so
legacy rows remain compatible. Shadow decisions use a separate unique
`{deviceId, measurementId}` index. No legacy identity is inferred or migrated.
