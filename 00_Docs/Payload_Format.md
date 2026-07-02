# Payload Format - Hydroponic_IoT_ESP32

All MQTT payloads must use JSON.

## Sensor Payload

```json
{
  "deviceId": "device001",
  "tdsRaw": 1830,
  "tdsPpm": 650,
  "waterTemp": 26.4,
  "waterLevel": "normal",
  "pumpMain": false,
  "pumpA": false,
  "pumpB": false,
  "ph": null,
  "createdAt": "2026-06-12T10:30:00+07:00"
}
```

## Pump Command Payload

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
- `ph` remains `null` in the current phase because pH is excluded for now.
