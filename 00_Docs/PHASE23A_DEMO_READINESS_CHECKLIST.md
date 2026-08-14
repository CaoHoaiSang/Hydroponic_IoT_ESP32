# Phase 23A Demo Readiness Checklist

## Safety Boundary

- [ ] Use only isolated Stage 0: MongoDB `127.0.0.1:27018`, MQTT `127.0.0.1:18884`, HTTP `127.0.0.1:3100`.
- [ ] Auto Dosing is OFF and cannot be enabled from the Dashboard.
- [ ] Actuator capability reports locked and pump commands disabled.
- [ ] No ESP32 upload, 12V pump power, nutrient line, or physical pump operation is required.
- [ ] Runtime Wi-Fi/MQTT credentials remain only in Git-ignored secret files.

## Clean Start

From `03_Edge_Server/mqtt_backend`:

```powershell
powershell -ExecutionPolicy Bypass -File .\staging\Reset-Staging.ps1
powershell -ExecutionPolicy Bypass -File .\staging\Start-Staging.ps1
npm run stage0:test
npm run phase23a:check
```

Acceptance:

- [ ] Backend, MongoDB, and MQTT are connected.
- [ ] Dashboard returns HTTP 200.
- [ ] At least three Telemetry Identity V2 rows exist.
- [ ] Shadow decision history exists.
- [ ] `pump_logs` count is zero.
- [ ] `dosing_runs` count is zero.
- [ ] Enabled Auto Dosing settings count is zero.

## Dashboard Recovery

- [ ] Fresh snapshot displays `connected-fresh`.
- [ ] A snapshot older than 120 seconds displays `connected-stale` but remains visible for observation.
- [ ] Backend outage displays `offline` and keeps actuator controls locked.
- [ ] After Backend recovery, the next five-second refresh returns to `connected-fresh`.
- [ ] No mock sensor value replaces missing runtime data.

## Backup And Restore

```powershell
powershell -ExecutionPolicy Bypass -File .\staging\Backup-Staging.ps1
```

- [ ] Backup is created only under ignored `.stage0_backups/`.
- [ ] Backup metadata identifies `127.0.0.1:27018/hydroponic_stage0`.
- [ ] Stop/reset/start creates an empty Stage 0 target before restore.
- [ ] Restore requires `RESTORE_EMPTY_STAGE0` and rejects a non-empty database.
- [ ] Readiness check passes again after restore.

## Demo Sequence

1. Show `/health` with API, MongoDB, and MQTT connected.
2. Open Dashboard `/overview` and show the fresh runtime banner.
3. Show Telemetry Identity V2 fields and distinct measurement progression.
4. Show Shadow Mode status/history as observation-only output.
5. Show Auto Dosing OFF and actuator controls locked.
6. Show zero pump log and zero dosing run evidence.
7. Export a supported CSV or create the isolated Stage 0 backup.
8. Stop Stage 0 after the demonstration.

## Abort Criteria

Stop the demo and keep actuator paths locked if any of these occur:

- Health does not confirm both MongoDB and MQTT.
- Dashboard reports stale/offline data without recovering.
- Auto Dosing is enabled or enable capability is exposed.
- Any pump command, pump log, or dosing run appears.
- An endpoint resolves outside the fixed Stage 0 loopback ports.
