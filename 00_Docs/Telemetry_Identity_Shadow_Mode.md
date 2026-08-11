# Telemetry Identity V2 And Shadow Mode - Phase 22A Fix 1

## Firmware Identity

Each new logical sensor measurement contains:

| Field | Type | Rule |
|---|---|---|
| `schemaVersion` | integer | Exactly `2` |
| `deviceId` | string | Existing device ID |
| `bootId` | string | Generated once per ESP32 boot; contains no secret |
| `measurementSeq` | positive integer | Increases for each new logical measurement |
| `measurementId` | string | `deviceId:bootId:measurementSeq` |
| `sampledAtUptimeMs` | non-negative integer | ESP32 uptime when the measurement was captured |

An MQTT retry keeps the complete serialized payload and all identity fields unchanged.
Internal ADC samples remain represented by `tdsSampleCount`; they are not measurements
and are not publish retries.

## Backend Order Policy

- The first boot observed for a device is accepted.
- A larger sequence in the accepted boot is accepted.
- A lower sequence in the accepted boot is `OUT_OF_ORDER`.
- A packet with an already stored identity is `DUPLICATE` and idempotent.
- The first packet from a different boot is `BOOT_TRANSITION_UNCONFIRMED`.
- A second increasing packet from that candidate confirms the new boot and retires the old boot.
- Later packets from a retired boot are `OLD_BOOT_PACKET` and cannot restore that boot.
- Server receive time is audit metadata only; it is not measurement identity and is not
  sufficient by itself to prove measurement freshness.

Only `ACCEPTED` V2 measurements update `devices.latest`, contribute to stability, or
produce a Shadow decision. Legacy telemetry may remain in `sensor_logs` for history but
is labeled `LEGACY_NO_IDENTITY` and is control-ineligible.

## Duplicate Protection

Application duplicate checks run before calibration, stability, Shadow Mode, and control.
MongoDB provides the race-condition backstop:

```javascript
db.sensor_logs.createIndex(
  { deviceId: 1, measurementId: 1 },
  {
    unique: true,
    partialFilterExpression: { schemaVersion: 2, telemetryIdentityValid: true },
    name: "unique_v2_measurement_per_device"
  }
)
```

Stability requires three distinct `measurementId` values from the same accepted boot,
inside the existing 120-second window, with verified freshness and all Phase 21
calibration/quality checks. The first unanchored measurement does not count; a new boot
therefore needs three later fresh accepted measurements before stability can become true.

## Freshness Policy

Fix 1 derives `measurementAt` from the most recent lower-sequence row in the same boot:

```text
measurementAt = anchor.measurementAt
              + (current.sampledAtUptimeMs - anchor.sampledAtUptimeMs)
```

The first row without a same-boot uptime anchor remains accepted for audit/latest but has
`measurementFreshnessVerified=false` and is control-ineligible. Later rows are verified
only when the uptime delta is positive and does not imply a sample time more than 5 seconds
in the future. A delayed MQTT retry therefore keeps its original estimated sample time and
fails `STALE_MEASUREMENT`; a new server receive time cannot make it fresh.
The delta calculation handles the 32-bit ESP32 `millis()` rollover within one boot.

Stored timing fields are `measurementAt`, `receivedAt`, `measurementFreshnessVerified`,
`measurementTimeSource`, and `measurementAgeAtReceiptMs`.

## Processing Recovery

Each V2 sensor row has a processing lifecycle: `PROCESSING`, `FAILED`, or `COMPLETED`.
The initial worker holds a 30-second lease. An error records a non-secret error code and
marks the row `FAILED`; a retry atomically claims and resumes the same row instead of being
discarded as a duplicate. Rows created before Fix 1 with order status `PROCESSING` can be
claimed; when the device telemetry session proves the exact same boot/sequence was already
accepted, order classification is reused instead of incorrectly reclassifying it as old.

## Shadow Mode

`SHADOW_MODE_ENABLED` is independent from Auto Dosing and defaults to `false`.
Phase 22A locks Auto Dosing OFF in source and on the dashboard. Shadow Mode has no MQTT
publisher dependency, does not write `dosing_runs`, and does not alter Auto Dosing settings.

The engine emits one decision:

- `ELIGIBLE`: all gates pass; the action is still hypothetical.
- `BLOCKED`: available data proves a safety gate is unsafe.
- `INSUFFICIENT_DATA`: required configuration/calibration data is missing.

The hypothetical action is `DOSE_STEP`, `NO_DOSE`, or `WAIT`. Dose amount and durations
are included only when all required values are real and all 30 gates pass.

Gate order and stable reason codes:

| No. | Gate | Representative failure reason |
|---:|---|---|
| 1 | Shadow enabled | `SHADOW_MODE_DISABLED` |
| 2 | Auto Dosing OFF | `AUTO_DOSING_MUST_REMAIN_OFF` |
| 3 | Schema V2 | `LEGACY_TELEMETRY` |
| 4 | Identity valid | `INVALID_TELEMETRY_IDENTITY` |
| 5 | Not duplicate | `DUPLICATE_MEASUREMENT` |
| 6 | Order accepted | `OUT_OF_ORDER`, `ORDER_NOT_ACCEPTED` |
| 7 | Boot session valid | `BOOT_TRANSITION_UNCONFIRMED` |
| 8 | Fresh measurement | `STALE_MEASUREMENT` |
| 9 | Firmware sample window | `INSUFFICIENT_FIRMWARE_SAMPLES` |
| 10 | Three distinct measurements | `INSUFFICIENT_DISTINCT_MEASUREMENTS` |
| 11 | Stable TDS | `TDS_UNSTABLE` |
| 12 | Active calibration | `NO_ACTIVE_CALIBRATION` |
| 13 | Three calibration points | `INSUFFICIENT_CALIBRATION_POINTS` |
| 14 | Inside calibration range | `OUTSIDE_CALIBRATION_RANGE` |
| 15 | Temperature compensation | `INVALID_TEMPERATURE_COMPENSATION` |
| 16 | Valid water temperature | `INVALID_WATER_TEMPERATURE` |
| 17 | Safe water level | `UNSAFE_WATER_LEVEL` |
| 18 | Main pump requirement | `MAIN_PUMP_OFF` |
| 19 | Pump A idle | `PUMP_A_RUNNING` |
| 20 | Pump B idle | `PUMP_B_RUNNING` |
| 21 | No active dosing run | `DOSING_RUN_ACTIVE` |
| 22 | Not mixing | `MIXING_IN_PROGRESS` |
| 23 | Pump A calibration | `MISSING_PUMP_A_CALIBRATION` |
| 24 | Pump B calibration | `MISSING_PUMP_B_CALIBRATION` |
| 25 | Crop is `cai_ngot` | `CROP_NOT_CONFIRMED` |
| 26 | Target confirmed | `UNCONFIRMED_TARGET` |
| 27 | Tank volume | Pass: not required by fixed-step V1 |
| 28 | Daily dose limit | `DAILY_LIMIT_REACHED`, `DAILY_LIMIT_DATA_MISSING` |
| 29 | Phase 21 dose/duration limits | `PUMP_DURATION_OR_DOSE_LIMIT_INVALID` |
| 30 | Phase 22 Auto Dosing lock | `AUTO_DOSING_LOCK_MISSING` |

The first failed gate supplies `primaryReasonCode`; all failures remain in `reasonCodes`.

Gate 28 uses the same `getDailyDoseUsage()` implementation as Phase 21, including the
latest `manual_daily_reset` window and active `in_progress`/`mixing_wait` runs. Shadow no
longer maintains a separate completed-run-only calculation.

Read-only endpoints:

```text
GET /api/devices/:deviceId/shadow-mode/status
GET /api/devices/:deviceId/shadow-mode/decisions?limit=20
```

Each accepted V2 measurement has at most one `shadow_dosing_decisions` row, enforced by
a unique `{deviceId, measurementId}` index.

## Runtime Status

Implementation, isolated fake-database tests, API tests, native C++ firmware-core harness,
and executable Dashboard render tests pass. The complete firmware compiled before Fix 1;
it has not been recompiled in the current environment after adding the host-testable
sequence/retry headers because Arduino CLI/PlatformIO is unavailable here.
Operational MongoDB, MQTT, ESP32 upload, dashboard browser runtime, and physical hardware
remain untested for Phase 22A. No production service or pump was used during implementation.
