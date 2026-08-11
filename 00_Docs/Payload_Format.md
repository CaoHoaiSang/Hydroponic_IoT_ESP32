# Payload Format - Phase 22A Fix 1

## ESP32 Sensor Payload

```json
{
  "schemaVersion": 2,
  "deviceId": "device001",
  "bootId": "a1b2c3d4e5f60718",
  "measurementSeq": 42,
  "measurementId": "device001:a1b2c3d4e5f60718:42",
  "sampledAtUptimeMs": 123456,
  "tdsRaw": 1830,
  "tdsVoltage": 1.475,
  "tdsMin": 1815,
  "tdsMax": 1844,
  "tdsSampleCount": 30,
  "tdsSpreadRaw": 29,
  "tdsWindowStable": true,
  "waterTemp": 26.4,
  "waterTempValid": true,
  "waterLevel": "normal",
  "pumpMain": false,
  "pumpA": false,
  "pumpB": false,
  "pumpSpare": false,
  "ph": null,
  "uptimeMs": 123456
}
```

Phase 22A validates identity fields together. A payload that contains any V2 identity
field but is incomplete or inconsistent is rejected. A payload with no identity fields
is labeled legacy and may be stored for history, but cannot update `devices.latest`,
contribute to stability, enter Shadow eligibility, or reach control.

The backend also enforces the exact firmware relationship:

```text
tdsWindowStable = (tdsSampleCount == 30 && tdsSpreadRaw <= 50)
```

A boolean that disagrees with sample count/spread is rejected. Stability evaluation checks
the relationship again and does not trust the boolean alone.

## Stored Measurement Quality Contract

Each accepted V2 `sensor_logs` row and `devices.latest` includes:

`measurementAt`, `receivedAt`, `measurementFreshnessVerified`, `measurementTimeSource`,
`measurementAgeAtReceiptMs`, `tdsRaw`, `tdsVoltage`, `tdsMin`, `tdsMax`, `tdsSampleCount`, `tdsSpreadRaw`,
`tdsWindowStable`, `tdsVoltage25`, `ecUsCm`, `tdsPpm`, `tdsFactor`, `tdsScale`,
`tdsCalibrationSetId`, `tdsCalibrationMode`, `tdsCalibrationPointCount`,
`tdsCalibrationInRange`, `tdsCalibrationWarning`, `tdsTemperatureCompensated`,
`tdsTemperatureAlphaPerC`, `tdsTemperatureFactorUsed`, `tdsTemperatureReferenceC`,
`tdsStable`, `tdsStabilitySampleCount`, `tdsStabilityDistinctMeasurementCount`, `tdsStabilitySpreadPpm`,
`tdsStabilityThresholdPpm`, `tdsStabilityReason`, `tdsControlValid`, and
`tdsControlInvalidReasons`.

It also includes `schemaVersion`, `bootId`, `measurementSeq`, `measurementId`,
`sampledAtUptimeMs`, `telemetryIdentityValid`, `telemetryDuplicate`,
`telemetryOrderStatus`, `telemetryBootSessionValid`, `controlEligible`,
and `controlExclusionReasons`. `sensor_logs` additionally records `processingState`,
`processingStage`, `processingAttempt`, lease/failure/completion timestamps, and a
non-secret processing error code when applicable.

`measurementAt` is not copied from `receivedAt`. Fix 1 derives it from the same-boot
`sampledAtUptimeMs` delta. Without a trustworthy anchor, freshness is unverified and the
measurement is excluded from control/Shadow eligibility even if it was just received.

Outside the active set range, `ecUsCm` and `tdsPpm` are null. No extrapolated control
value is published or stored.

Pump command/status payloads remain unchanged. Pump A/B remain pulse-only; continuous
`set` applies only to the main pump.
