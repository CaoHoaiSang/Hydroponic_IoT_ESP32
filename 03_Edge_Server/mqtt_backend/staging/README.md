# Phase 22B Stage 0 - Isolated Staging

This staging stack is loopback-only and uses no production credential or endpoint.

## Fixed Isolation Contract

| Component | Stage 0 value |
|---|---|
| MongoDB | `mongodb://127.0.0.1:27018` |
| Database | `hydroponic_stage0` |
| MQTT | `mqtt://127.0.0.1:18884` |
| Backend and Dashboard | `http://127.0.0.1:3100` |
| Sensor topic | `stage0/hydroponic/device001/sensor` |
| Pump command topic | `stage0/hydroponic/device001/pump/cmd` |
| Pump status topic | `stage0/hydroponic/device001/pump/status` |
| Auto Dosing | Hard-locked OFF |
| Manual pump commands | Disabled by `PUMP_COMMANDS_DISABLED=true` |

The scripts refuse to reuse an occupied staging port. Existing services on MongoDB
`27017` or MQTT `1883` are never used.

## Commands

From `03_Edge_Server/mqtt_backend`:

```powershell
powershell -ExecutionPolicy Bypass -File .\staging\Start-Staging.ps1
npm run stage0:test
powershell -ExecutionPolicy Bypass -File .\staging\Get-StagingStatus.ps1
powershell -ExecutionPolicy Bypass -File .\staging\Stop-Staging.ps1
powershell -ExecutionPolicy Bypass -File .\staging\Reset-Staging.ps1
```

`Reset-Staging.ps1` stops only processes whose PID, executable path, and start time match
the recorded Stage 0 state. It then deletes only `staging/.stage0_runtime` after validating
the resolved path.

Runtime data and logs are stored under `staging/.stage0_runtime/` and are ignored by Git.
The sample environment file contains no secret. No ESP32 connection or firmware upload is
required for Stage 0.

## Coverage

The executable staging check uses the isolated real MongoDB and MQTT instances plus the
production backend and Dashboard files. It verifies Telemetry Identity V2, boot transition,
duplicates, retry idempotency, out-of-order data, delayed freshness, three distinct stable
measurements, Shadow status/history, API/Dashboard responses, Auto Dosing OFF, rejected
manual pump paths, zero pump command, zero pump log, and zero dosing run.

## Phase 23A Backup And Demo Check

Stage 0 backup is EJSON so MongoDB dates and object IDs remain typed. It is fixed to
`127.0.0.1:27018/hydroponic_stage0`; production/default MongoDB is rejected.

```powershell
powershell -ExecutionPolicy Bypass -File .\staging\Backup-Staging.ps1
npm run phase23a:check
```

Backup files are created under ignored `staging/.stage0_backups/`. Restore requires a running,
empty Stage 0 database and an exact confirmation:

```powershell
powershell -ExecutionPolicy Bypass -File .\staging\Restore-Staging.ps1 `
  -InputPath .\staging\.stage0_backups\<backup-file>.ejson `
  -Confirm RESTORE_EMPTY_STAGE0
```

The readiness checker is read-only. It requires Backend/MongoDB/MQTT health, Dashboard HTTP 200,
locked actuator capability, Auto Dosing unavailable, Telemetry Identity/Shadow evidence, zero
pump logs, and zero dosing runs.
