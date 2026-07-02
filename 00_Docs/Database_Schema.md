# Database Schema - Hydroponic_IoT_ESP32

MongoDB Atlas will store long-term data for the core phase.

## 1. devices

| Field | Purpose |
|---|---|
| deviceId | Unique device identifier, such as device001 |
| name | Human-readable device name |
| status | Device status, such as online, offline, or maintenance |
| lastSeenAt | Last time the backend received data from the device |

## 2. sensor_logs

| Field | Purpose |
|---|---|
| deviceId | Device identifier |
| tdsRaw | Raw ADC reading from TDS sensor |
| tdsPpm | Estimated TDS value in ppm |
| waterTemp | Water temperature in Celsius |
| waterLevel | Water level enum: normal, low, or error |
| pumpMain | Current main pump state |
| pumpA | Current pump A state |
| pumpB | Current pump B state |
| ph | Reserved for later; null in current phase |
| createdAt | Timestamp for the reading |

## 3. pump_logs

| Field | Purpose |
|---|---|
| deviceId | Device identifier |
| pumpType | Pump enum: main, A, B, or spare |
| action | Pump action: on, off, or pulse |
| durationMs | Duration for pulse commands |
| estimatedMl | Estimated volume for calibrated pumps |
| reason | Reason enum, such as manual_test or calibration |
| createdAt | Timestamp for the pump event |

## 4. alerts

| Field | Purpose |
|---|---|
| deviceId | Device identifier |
| type | Alert type |
| level | Alert severity |
| message | Human-readable alert message |
| createdAt | Timestamp for the alert |
| resolved | Whether the alert has been resolved |

## Optional Later: 5. pump_calibrations

| Field | Purpose |
|---|---|
| deviceId | Device identifier |
| pumpType | Pump enum: A or B |
| testDurationSec | Calibration test duration in seconds |
| measuredMl | Measured output volume in ml |
| flowRateMlPerSec | Calculated pump flow rate |
| createdAt | Timestamp for the calibration record |
