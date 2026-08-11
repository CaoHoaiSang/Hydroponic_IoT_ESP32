# CODEX PHASE 22A FINAL REPORT

Project: `Hydroponic_IoT_ESP32`  
Phase: `22A - Firmware Build, Telemetry Identity V2 and Shadow Mode`  
Date: `2026-08-09`  
Git HEAD inspected: `be1e879d5188e4d8c004a5814518bc5c6638cfa0` (`be1e879 31-07-2026`)

## 1. Executive Summary

Phase 22A is implemented in the existing dirty working tree without reverting the
user's cumulative Phase 21 work. The ESP32 firmware now emits boot-scoped Telemetry
Identity V2 and preserves the exact identity/payload across MQTT retries. The backend
validates identity, rejects malformed V2 data, handles duplicate delivery idempotently,
classifies sequence/boot order, and only lets accepted V2 measurements update latest,
stability, or Shadow evaluation.

Stability now requires three distinct accepted `measurementId` values from the same
accepted boot session. A pure 30-gate Shadow engine records hypothetical decisions in a
separate collection. It has no pump publisher dependency and does not write
`dosing_runs`. Auto Dosing is locked OFF in production settings, telemetry processing,
pump-status continuation, and dashboard UI.

Both baseline and final firmware compilation passed. The final backend suite passed
`166/166`; all 42 JavaScript files passed syntax checks. No firmware upload, physical
pump operation, production MongoDB access, operational MQTT connection/publish, or live
calibration lifecycle mutation occurred.

## 2. Requirement Status

| Requirement | Status | Evidence/notes |
|---|---|---|
| Establish actual project/toolchain baseline | PASS | Git, source, tests, Arduino IDE CLI/core/libraries inspected. |
| Compile baseline firmware | PASS | 941080 flash bytes, 47152 static RAM bytes, exit 0. |
| Implement firmware Identity V2 | PASS | Schema, boot ID, sequence, measurement ID, sampled uptime implemented. |
| Preserve identity and content on MQTT retry | PASS | Pending serialized payload is reused until successful publish. |
| Keep payload inside MQTT buffer | PASS | Buffer raised to 1024; representative max fixture plus topic passes; firmware compiles. |
| Keep official GPIO unchanged | PASS | GPIO 34, 4, 27, 25, 26, 14, 33 verified in source/test. |
| Validate V2 identity fail-closed | PASS | Missing, invalid, negative, non-finite, and inconsistent identity tests pass. |
| Application duplicate protection | PASS | Pre-calibration lookup and idempotent return implemented. |
| Database race duplicate protection | PASS | Partial unique sensor index and duplicate-key handling implemented/tested. |
| Out-of-order protection | PASS | Audit-only; does not update latest, stability, Shadow, or control. |
| Conservative boot transition | PASS | Candidate boot needs second increasing packet; retired boots remain retired. |
| Legacy compatibility | PASS | Legacy row may be stored; latest/stability/Shadow/control exclusion tested. |
| Three distinct measurement stability | PASS | Same-boot, accepted-only, distinct-ID query and deduplication implemented/tested. |
| Pure Shadow decision engine | PASS | 30 gates, deterministic reasons, no publisher/repository dependency. |
| Shadow decision persistence | PASS | Unique decision per device/measurement implemented/tested. |
| Shadow read-only API | PASS | Status and history routes exercised through real Express routes with fake DB. |
| Dashboard Identity/Shadow UI | PASS | Static contract tests pass; 5-second refresh retained. |
| Dashboard browser visual/runtime check | NOT TESTED | No operational service/browser session was started. |
| Auto Dosing remains OFF | PASS | Runtime lock, settings rejection, MQTT path removal, UI lock, and tests. |
| Preserve Pump A -> Pump B -> mixing wait | PASS | Phase 21 regression tests pass using an explicit test-only bypass. Production telemetry cannot enter it. |
| MongoDB indexes in operational database | NOT TESTED | Definitions implemented; no production/staging DB connection in this phase. |
| Operational MQTT/ESP32 runtime | NOT TESTED | No broker connection, firmware upload, or hardware operation. |
| Final firmware compile | PASS | 943508 flash bytes, 47208 static RAM bytes, exit 0. |
| Full isolated test suite | PASS | 166 passed, 0 failed, 0 skipped, exit 0. |
| Review archive | PASS | 128 entries, forbidden-entry count 0, ZIP opens, SHA-256 recorded below. |

## 3. Baseline Before Phase 22A

- Existing Phase 21 Fix 2 suite: `84 passed`, `0 failed`.
- Existing syntax baseline: `34` JavaScript files passed before new Phase 22 files.
- Auto Dosing default: `enabled: false`.
- Existing sequence: Pump A -> Pump B -> `mixing_wait` -> eligible fresh measurement.
- Existing firmware quality: nonblocking 30-sample TDS ring window and nonblocking
  DS18B20 conversion from Phase 21.
- Existing weakness addressed here: no firmware measurement identity, duplicate rows
  could count toward the three-payload stability window, and no Shadow-only decision path.
- Working tree was already dirty with cumulative Phase 21 files. Those changes were
  preserved and are included in the review snapshot.

## 4. Files Created In Phase 22A

| File | Purpose |
|---|---|
| `00_Docs/Telemetry_Identity_Shadow_Mode.md` | V2 identity/order/index/Shadow contract and all 30 gates. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/TelemetryIdentity.h` | Firmware identity data structure/API. |
| `02_ESP32_Main_Firmware/Hydroponic_Device001/TelemetryIdentity.cpp` | Boot ID and monotonic measurement sequence generation. |
| `03_Edge_Server/mqtt_backend/src/config/phase22Config.js` | Hard Auto Dosing lock, independent Shadow config, schema/engine versions. |
| `03_Edge_Server/mqtt_backend/src/services/telemetryIdentityService.js` | Order classification and CAS-persisted boot session. |
| `03_Edge_Server/mqtt_backend/src/services/telemetryPipelineService.js` | Production sensor persistence -> Shadow orchestration. |
| `03_Edge_Server/mqtt_backend/src/services/shadowDosingEngine.js` | Pure 30-gate decision function. |
| `03_Edge_Server/mqtt_backend/src/services/shadowDosingService.js` | Context read, decision persistence, read-only queries. |
| `03_Edge_Server/mqtt_backend/test/phase22TelemetryIdentity.test.js` | Validator, order, stability, Auto lock, GPIO/buffer/firmware contract tests. |
| `03_Edge_Server/mqtt_backend/test/phase22ShadowEngine.test.js` | Full Shadow gate/result/no-side-effect tests. |
| `03_Edge_Server/mqtt_backend/test/phase22Pipeline.test.js` | Production-path fake-DB, concurrency, API, legacy, boot, and Shadow tests. |
| `CODEX_PHASE22A_FINAL_REPORT.md` | This self-contained handoff report. Excluded from ZIP by requirement. |
| `Hydroponic_IoT_ESP32_PHASE22A_REVIEW.zip` | Secret-safe current working-tree snapshot. |

## 5. Files Modified In Phase 22A

| File/group | Purpose |
|---|---|
| `README.md` | Current Phase 22A state and safe start guidance. |
| `00_Docs/PROJECT_PLAN.md` | Added Phase 22A. |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Current implementation/test/runtime state and file inventory. |
| `00_Docs/Payload_Format.md` | Complete V2 payload and persisted quality/identity fields. |
| `00_Docs/Database_Schema.md` | Telemetry session, partial unique index, Shadow collection/index. |
| `04_Database/mongodb_schema.md` | Phase 22A database summary. |
| `04_Database/sample_payload.json` | Valid V2 sample payload. |
| Firmware `Config.h` | Schema 2 and 1024-byte MQTT packet buffer; GPIO unchanged. |
| Firmware `Hydroponic_Device001.ino` | Boot initialization and retry-persistent sensor payload. |
| Firmware `MqttService.cpp` | Uses named MQTT buffer size. |
| Firmware `PayloadBuilder.h/.cpp` | Serializes V2 identity and prints human-readable sensor status. |
| Backend `.env.example` | Adds `SHADOW_MODE_ENABLED=false`. |
| Backend `README.md` | Identity/order/Shadow/API/Auto lock documentation. |
| Dashboard `public/index.html` | Identity, quality, Shadow decision/gate/history UI; enable checkbox locked. |
| Dashboard `public/styles.css` | Responsive Telemetry/Shadow layout. |
| Dashboard `public/app.js` | Safe render/load logic and read-only Shadow refresh. |
| `src/mongoClient.js` | Sensor V2 partial unique, order query, Shadow unique/history indexes. |
| `src/mqttClient.js` | Calls production telemetry pipeline; no Auto Dosing sensor/status continuation. |
| `src/routes/deviceRoutes.js` | Two read-only Shadow endpoints and HTTP 409 for Auto lock. |
| `src/services/autoDosingService.js` | Production OFF lock at settings/evaluation/status paths. |
| `src/services/sensorLogService.js` | Validation -> duplicate -> order -> accepted calibration/stability/latest pipeline. |
| `src/services/tdsQualityService.js` | Same-boot accepted V2 distinct-ID stability. |
| `src/validators/sensorPayloadValidator.js` | Identity type/range/relationship validation. |
| `test/dashboardContract.test.js` | Identity/Shadow/legacy/locked-control UI contract. |
| `test/phase21FixBehavior.test.js` | Explicit test-only bypass preserves sequence/concurrency regression tests. |
| `testSupport/fakeMongo.js` | Fake unique constraints for V2 logs and Shadow decisions. |

Pre-existing Phase 21 modifications and untracked files shown by `git status --short`
were not reverted. The ZIP contains the complete current working tree, not only the
Phase 22A delta.

## 6. Logic Before And After

Before:

```text
Periodic sensor payload
-> save sensor row
-> server timestamp-based recent-row stability
-> devices.latest
-> direct Auto Dosing evaluation
```

After:

```text
Firmware creates one logical measurement identity
-> retries exact same serialized payload if MQTT publish fails
-> backend validates complete V2 identity
-> application duplicate precheck
-> partial unique DB reservation
-> boot/sequence classification
-> rejected order states remain audit-only
-> accepted V2 calibration
-> same-boot distinct-measurement stability
-> accepted-only devices.latest
-> pure Shadow evaluation
-> one Shadow decision record
```

The production MQTT path does not call `evaluateAutoDosing()` or
`handlePumpStatusForAutoDosing()` in Phase 22A. Pump A -> Pump B -> mixing-wait code is
retained and remains covered by Phase 21 regression tests, but the production runtime
lock returns before any command publication.

## 7. Telemetry Payload V2

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

| Field | Type/rule |
|---|---|
| `schemaVersion` | Integer, exactly 2. |
| `deviceId` | Non-empty string. |
| `bootId` | 8-64 safe identifier characters; firmware emits 16 hex characters. |
| `measurementSeq` | Positive JavaScript-safe integer; firmware uses increasing `uint32_t`. |
| `measurementId` | Exact `deviceId:bootId:measurementSeq`. |
| `sampledAtUptimeMs` | Non-negative safe integer, not after `uptimeMs`. |
| Existing sensor fields | Phase 21 type/range/relationship rules remain enforced. |

The firmware's `bootId` is generated once per boot from ESP32 random values. It is an
identifier, not a secret or authentication token. Server receive time remains freshness
and audit metadata only.

## 8. Duplicate Policy

1. Validate before persistence.
2. Look up `{deviceId, measurementId}` before calibration/stability/Shadow/control.
3. Insert a V2 audit reservation protected by a partial unique index.
4. Catch MongoDB duplicate-key error for near-concurrent requests.
5. Return `{ok:true, duplicate:true, idempotent:true}`.
6. Update only duplicate-receipt audit metadata on the original row.
7. Do not create a second sensor log, update latest/stability, create a second Shadow
   decision, call Auto Dosing, create a run, or publish a pump command.

## 9. Out-Of-Order And Boot Policy

- First-ever observed boot: accepted because no prior boot can conflict.
- Current boot with increasing sequence: `ACCEPTED`.
- Current boot with lower/equal non-duplicate sequence: `OUT_OF_ORDER`.
- First packet from a different boot: `BOOT_TRANSITION_UNCONFIRMED`.
- Second increasing packet from that candidate: confirms new current boot.
- Previous current boot is placed in `retiredBootIds`.
- Any later packet from any retired boot: `OLD_BOOT_PACKET`; it cannot become current.
- A valid packet from the current boot cancels a stray unconfirmed candidate.
- Sequence is partitioned by boot. Only accepted packets contribute after transition.
- `telemetrySession.revision` is used for compare-and-set retries during concurrent order
  updates.

## 10. Legacy Policy

Legacy payloads with no V2 identity fields may be stored for historical dashboard
compatibility with:

```json
{
  "telemetryIdentityValid": false,
  "telemetryDuplicate": false,
  "telemetryOrderStatus": "LEGACY_NO_IDENTITY",
  "telemetryBootSessionValid": false,
  "controlEligible": false
}
```

They never update `devices.latest`, count toward stability, create Shadow eligibility,
call Auto Dosing, create a run, or publish a command. A partially present V2 identity is
not legacy; it is invalid and rejected.

## 11. Exact Indexes

Sensor duplicate protection:

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

Order query:

```javascript
db.sensor_logs.createIndex({
  deviceId: 1,
  bootId: 1,
  telemetryOrderStatus: 1,
  receivedAt: -1
})
```

Shadow uniqueness/history:

```javascript
db.shadow_dosing_decisions.createIndex(
  { deviceId: 1, measurementId: 1 },
  { unique: true, name: "unique_shadow_decision_per_measurement" }
)
db.shadow_dosing_decisions.createIndex({ deviceId: 1, createdAt: -1 })
```

These index declarations were not applied to an operational database in this phase.

## 12. Stability Contract

Backend control stability requires all of the following for three rows:

- Distinct `measurementId` values.
- `schemaVersion=2`.
- `telemetryIdentityValid=true`.
- `telemetryDuplicate!=true`.
- `telemetryOrderStatus=ACCEPTED`.
- `telemetryBootSessionValid=true`.
- Same `bootId` and active calibration set.
- Inside the 120-second Phase 21 window.
- Firmware window exactly 30 samples, raw spread <= 50, and stable flag relationship.
- Valid calibrated TDS/EC measurement.
- Existing 20 ppm / 3% spread threshold remains unchanged.

Historic duplicate rows are deduplicated by `measurementId` before counting.

## 13. Shadow Architecture

`shadowDosingEngine.js` is a pure function. It accepts a context and returns a decision;
it does not import MQTT, pump command services, or a dosing-run repository.

`shadowDosingService.js` only reads context and inserts into
`shadow_dosing_decisions`. It never writes `dosing_runs` or Auto Dosing settings. The
production telemetry pipeline invokes it only for accepted V2 measurements.

Decision values:

- `ELIGIBLE`: all gates pass; still hypothetical only.
- `BLOCKED`: data proves an unsafe condition.
- `INSUFFICIENT_DATA`: required calibration/configuration data is absent.

Hypothetical actions: `DOSE_STEP`, `NO_DOSE`, `WAIT`. Amount/duration fields remain null
unless all gates pass and the hypothetical action is `DOSE_STEP`.

## 14. Shadow Safety Gates

1. Shadow Mode enabled.
2. Auto Dosing OFF.
3. Telemetry schema V2.
4. Identity valid.
5. Not duplicate.
6. Order accepted.
7. Boot/session valid.
8. Measurement fresh.
9. Firmware sample window valid.
10. Three distinct backend measurements.
11. TDS stable.
12. Active calibration set.
13. At least three calibration points.
14. Inside interpolation range.
15. Temperature compensation valid.
16. Water temperature valid.
17. Water level safe.
18. Main pump in required state.
19. Pump A idle.
20. Pump B idle.
21. No active dosing run.
22. No mixing wait.
23. Pump A calibration valid.
24. Pump B calibration valid.
25. Crop `cai_ngot`.
26. Target confirmed.
27. Tank volume gate: explicitly not required for fixed-step V1.
28. Daily dose limit.
29. Existing Phase 21 dose/duration limits.
30. Phase 22 Auto Dosing hard lock present.

## 15. Stable Reason Codes

`SHADOW_MODE_DISABLED`, `AUTO_DOSING_MUST_REMAIN_OFF`, `LEGACY_TELEMETRY`,
`INVALID_TELEMETRY_IDENTITY`, `DUPLICATE_MEASUREMENT`, `OUT_OF_ORDER`,
`ORDER_NOT_ACCEPTED`, `BOOT_TRANSITION_UNCONFIRMED`, `STALE_MEASUREMENT`,
`INSUFFICIENT_FIRMWARE_SAMPLES`, `INSUFFICIENT_DISTINCT_MEASUREMENTS`, `TDS_UNSTABLE`,
`NO_ACTIVE_CALIBRATION`, `INSUFFICIENT_CALIBRATION_POINTS`,
`OUTSIDE_CALIBRATION_RANGE`, `INVALID_TEMPERATURE_COMPENSATION`,
`INVALID_WATER_TEMPERATURE`, `UNSAFE_WATER_LEVEL`, `MAIN_PUMP_OFF`, `PUMP_A_RUNNING`,
`PUMP_B_RUNNING`, `DOSING_RUN_ACTIVE`, `MIXING_IN_PROGRESS`,
`MISSING_PUMP_A_CALIBRATION`, `MISSING_PUMP_B_CALIBRATION`, `CROP_NOT_CONFIRMED`,
`UNCONFIRMED_TARGET`, `DAILY_LIMIT_REACHED`, `DAILY_LIMIT_DATA_MISSING`,
`PUMP_DURATION_OR_DOSE_LIMIT_INVALID`, `AUTO_DOSING_LOCK_MISSING`,
`TDS_BELOW_TARGET`, and `TDS_AT_OR_ABOVE_TARGET`.

`primaryReasonCode` follows gate order. `reasonCodes` retains all failed gates.

## 16. API And Dashboard Contract

Read-only APIs:

```text
GET /api/devices/:deviceId/shadow-mode/status
GET /api/devices/:deviceId/shadow-mode/decisions?limit=20
```

Dashboard displays Auto Dosing OFF, Shadow ON/OFF, schema, boot/measurement identity,
sequence, sample uptime, newest receipt classification, raw/calibrated EC/TDS, active
set, firmware sample count, distinct count, stability, 30 gates, decision, primary/all
reasons, hypothetical action/value only when available, and history. Legacy/missing
values render as `Legacy`/`N/A`; no `undefined`/`NaN` contract is used.

The existing 5-second refresh remains. The Auto Dosing enable checkbox is disabled and
the backend independently rejects `enabled=true` with HTTP 409.

## 17. Database And Migration

New collection: `shadow_dosing_decisions`. New device metadata:
`telemetrySession`. New sensor/latest fields include original identity,
`telemetryIdentityValid`, `telemetryDuplicate`, `telemetryOrderStatus`,
`telemetryBootSessionValid`, `controlEligible`, `controlExclusionReasons`, and
`receivedAt`.

No Phase 22 data migration is needed or implemented. Existing rows remain legacy; no
synthetic measurement ID is generated from server time or sensor values.

The existing Phase 21 migration was exercised only against fake fixtures:

```text
Command: node --test test/stabilityMigration.test.js
Result: 31 passed, 0 failed, 0 skipped
Exit code: 0
Write confirmation: migration dry-run test observed zero fake-database writes
```

No operational migration command was run.

## 18. Firmware Build Evidence

Toolchain:

```text
arduino-cli 1.5.1
Commit 01f3d4f2b, build date 2026-06-05
ESP32 core esp32:esp32 3.3.10
ArduinoJson 7.4.3
DallasTemperature 4.0.6
OneWire 2.3.8
PubSubClient 2.8
```

Verified FQBN:

```text
esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default
```

Compile command used for baseline and final:

```powershell
& 'D:\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe' compile --fqbn 'esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default' 'D:\Hydroponic_IoT_ESP32\02_ESP32_Main_Firmware\Hydroponic_Device001'
```

Baseline result:

```text
PASS, exit 0
Flash: 941080 / 1310720 bytes (71%)
Static RAM: 47152 / 327680 bytes (14%), 280528 bytes remaining
```

Final result:

```text
PASS, exit 0
Flash: 943508 / 1310720 bytes (71%)
Static RAM: 47208 / 327680 bytes (14%), 280472 bytes remaining
```

Firmware was compiled only. It was not uploaded.

## 19. Test And Static Verification

Baseline:

```text
Command: npm test
Result: 84 passed, 0 failed
Exit code: 0
```

Final full suite:

```text
Command: npm test
Runner: node --test
Tests: 166
Pass: 166
Fail: 0
Skipped: 0
Cancelled: 0
Todo: 0
Exit code: 0
Final measured duration: 947.9834 ms
```

Syntax:

```text
Command: node --check <each JavaScript file under src, public, test, testSupport, scripts>
Files checked: 42
Failures: 0
Exit code: 0
```

Other checks:

```text
package.json JSON parse: PASS
04_Database/sample_payload.json parse: PASS
git diff --check: PASS, exit 0 (line-ending conversion warnings only)
Targeted active MQTT Auto Dosing reference search: NONE
Targeted Shadow publisher/dosing-run writer search: NONE
Secret pattern file count: 0
```

An isolated test temporarily opened an ephemeral loopback Express listener on an OS
assigned port and closed it. It used the fake database. It did not start the project
service process, MongoDB, or MQTT.

## 20. End-To-End Evidence

The production modules were exercised as:

```text
V2 fixture
-> validateSensorPayload
-> saveSensorPayload
-> application/unique duplicate guard
-> classifyAndPersistTelemetryOrder
-> applyTdsCalibration
-> evaluateTdsStability with distinct IDs
-> devices.latest update for accepted V2 only
-> evaluateAndSaveShadowDecision
-> shadow_dosing_decisions
-> real Express read-only routes
-> dashboard static contract
```

Covered scenarios include three distinct accepted measurements, three concurrent copies
of one identity, duplicate-key handling, out-of-order receipt, legacy receipt, malformed
V2 identity, missing calibration, new-boot confirmation, retired old-boot rejection,
read-only API output, dashboard V2/legacy fallback, and Shadow eligible with zero command.

## 21. Safety Evidence

- Duplicate stability exclusion: `tdsQualityService.js:34-53,90-114`; tests prove three
  copies produce distinct count 1 and `tdsStable=false`.
- Application duplicate gate: `sensorLogService.js:142-168` runs before calibration and
  stability.
- Accepted-only latest: `sensorLogService.js:168-213`.
- Partial unique sensor index: `mongoClient.js:55-65`.
- Same-boot/order stability query: `tdsQualityService.js:97-102`.
- Auto Dosing constant lock: `phase22Config.js:8`.
- Settings/evaluation/status lock: `autoDosingService.js:166-172,604-606,1036-1038`.
- Production MQTT contains no Auto Dosing invocation: `mqttClient.js` targeted search
  returned none.
- Pure Shadow gates: `shadowDosingEngine.js:18-99`.
- Shadow persistence targets only its own collection: `shadowDosingService.js:95`.
- Shadow modules contain no `publishPump` or dosing-run insert reference: targeted search
  returned none.
- Dashboard enable checkbox lock: `public/index.html:695`, `public/app.js:1209,1265`.
- Firmware retry identity: `Hydroponic_Device001.ino:115-137`.
- Firmware GPIO and buffer: `Config.h:12-20,49`.

## 22. Runtime State By Subsystem

| Subsystem | State |
|---|---|
| Firmware source | Implemented; baseline/final compile PASS; hardware upload NOT TESTED. |
| Backend | Implemented; syntax and fake-DB production-path tests PASS; operational runtime NOT TESTED. |
| Dashboard | Implemented; static contract PASS; browser visual/runtime NOT TESTED. |
| Database | Schema/index code implemented; fake persistence tests PASS; operational index creation NOT TESTED. |
| MQTT | Production flow changed in source; no operational broker connection/publish. |
| Shadow Mode | Engine/service/API tested in isolation; deployment runtime NOT TESTED. |
| Auto Dosing | Locked OFF in Phase 22A; historical sequence regression tests PASS only with explicit test bypass. |
| Hardware/pumps | Not operated. Official pins unchanged. |

## 23. Risks And Limitations

- `bootId` provides identity partitioning, not cryptographic device authentication.
- Boot transition intentionally excludes the first packet of a new boot; stability needs
  three later accepted measurements from that boot.
- The retired-boot list is retained to prevent any known old boot returning. Long-running
  deployments should monitor document growth if reboot counts become very large.
- CAS/order and unique-index behavior is tested with a fake repository and source-level
  Mongo contract, not an operational replica set or concurrent staging workload.
- Dashboard layout was not visually inspected in a live browser because no operational
  service was started.
- Actual MQTT retry behavior on ESP32 hardware remains unverified despite successful compile.
- Shadow thresholds/calibrations remain prototype inputs and need staging telemetry review.
- No authentication exists. Read-only Shadow endpoints follow the existing unauthenticated prototype.
- pH remains null; Adaptive Dosing, Zalo Bot, and AI Camera remain unimplemented.

## 24. Work Not Performed

- No production or operational database connection.
- No operational MQTT connection or publish.
- No live migration or index creation.
- No calibration set activation or retirement.
- No Auto Dosing enable.
- No firmware upload.
- No dashboard operational/browser session.
- No physical sensor or pump operation.
- No DOCX Phase 20D edits.
- No Git commit or push.

## 25. Recommended Phase 22B Priority

1. Independent source re-audit using the ZIP and this report.
2. Create an isolated staging MongoDB and broker with no production credentials.
3. Apply indexes to staging and inspect any conflicts before deployment.
4. Upload the compiled firmware with pumps/nutrient bottles disconnected.
5. Verify retry keeps one measurement ID and one sensor/Shadow row.
6. Verify reboot transition: first new-boot packet unconfirmed, second confirms, old boot rejected.
7. Verify three distinct accepted measurements are required for stability.
8. Verify dashboard V2, out-of-order/legacy fallback, gates, and history visually.
9. Keep Auto Dosing OFF throughout Phase 22B staging observation.

## 26. Review Archive

File: `Hydroponic_IoT_ESP32_PHASE22A_REVIEW.zip`  
SHA-256: `F50FAC97969C431EC41EF2C22F1CAF1D043D0D5EDC5E78BBE1FAC02F3811A5E4`  
Size: `224362 bytes`  
Inventory: `128 entries`  
Archive open/list check: `PASS`  
Forbidden entry count: `0`

Excluded groups:

- `.git/`
- `node_modules/`
- `.env` (but not `.env.example`)
- `Secrets.h` (but not `Secrets.h.example`)
- filenames containing credential/token
- database dumps by policy; none found/included
- `build/`, `dist/`, `coverage/`, cache and temporary directories
- `.vscode/` user-specific settings
- old/new compressed archives (`*.zip`)
- `CODEX_PHASE22A_FINAL_REPORT.md`

The report is intentionally delivered separately and is not inside the ZIP, avoiding a
self-referential ZIP hash.

## 27. Secret Confirmation

The source scan checked for private-key headers, credentialed MongoDB SRV strings, and
common API/token formats while excluding real secret files and archives. It found zero
matching files. No URI, password, credential, token, private key, database dump, or
operational secret is printed in this report or included in the review ZIP.

## 28. Mandatory Safety Confirmations

```text
Auto Dosing remains OFF. - CONFIRMED
Shadow Mode sent zero pump commands. - CONFIRMED
Shadow Mode created zero dosing runs. - CONFIRMED
Duplicate telemetry did not contribute to stability. - CONFIRMED
Out-of-order telemetry did not contribute to stability or control. - CONFIRMED
Legacy telemetry remained control-ineligible. - CONFIRMED
No production database was accessed. - CONFIRMED
No operational MQTT message was published. - CONFIRMED
No calibration set was activated or retired. - CONFIRMED
Firmware was not uploaded to hardware. - CONFIRMED
No physical pump was operated. - CONFIRMED
```
