# Payload Format - Hydroponic_IoT_ESP32

All MQTT payloads must use JSON.

## Main Firmware V2 Sensor Payload

MQTT topic: `hydroponic/device001/sensor`

This payload is published by ESP32 Main Firmware V2. It contains raw TDS ADC data, estimated TDS voltage, water temperature, water level, pump states, and device uptime.

```json
{
  "deviceId": "device001",
  "tdsRaw": 2814,
  "tdsVoltage": 2.267,
  "tdsMin": 2760,
  "tdsMax": 2843,
  "waterTemp": 31.00,
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

### Current V2 Notes

- `tdsPpm` is not implemented yet. Current firmware only publishes raw ADC and estimated voltage.
- `ph` remains `null` because pH is excluded from the current phase.
- `createdAt` is not included yet because NTP time is not implemented on the ESP32.
- `uptimeMs` is included so payload timing can be checked before NTP is added.
- Backend/database code should add a server-side timestamp later.

## Pump Command Payload

Reserved for a later phase. MQTT pump command subscription is not implemented in Main Firmware V2.

```json
{
  "deviceId": "device001",
  "pump": "A",
  "action": "pulse",
  "durationMs": 5000,
  "reason": "manual_test"
}
```

## Pump Status Payload

Reserved for a later phase.

```json
{
  "deviceId": "device001",
  "pump": "A",
  "action": "pulse",
  "durationMs": 5000,
  "success": true,
  "pumpMain": false,
  "pumpA": false,
  "pumpB": false,
  "reason": "manual_test"
}
```

## Alert Payload

Reserved for a later phase.

```json
{
  "deviceId": "device001",
  "type": "water_level_low",
  "level": "warning",
  "message": "Water level is low",
  "resolved": false
}
```

## Valid Enum Values

### waterLevel

- normal
- low
- error

### pump

- main
- A
- B
- spare

### action

- on
- off
- pulse

### reason

- manual_test
- calibration
- auto_dosing

## Notes

- `auto_dosing` is reserved for later. Do not implement full auto dosing now.
- Pump command subscription is not part of Main Firmware V2.
