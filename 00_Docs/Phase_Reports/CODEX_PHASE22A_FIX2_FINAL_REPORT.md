# CODEX PHASE 22A FIX 2 FINAL REPORT

## 1. Executive Summary

Kết luận cuối cùng:

`PASS - READY FOR PHASE 22B STAGING PREPARATION`

Cuộc re-audit độc lập được thực hiện từ ZIP Fix 1 đã xác minh, giải nén vào một
thư mục sạch. Re-audit phát hiện một lỗi đồng thời có thể tái hiện: hai retry gần
đồng thời có thể cùng claim một row `PROCESSING` đã hết lease. Lỗi được sửa tối
thiểu bằng compare-and-set theo trạng thái, lease và attempt; regression test mới
chứng minh chỉ một retry được xử lý.

Sau Fix 2, toàn bộ 173 test pass, 43 file JavaScript pass syntax check, Dashboard
DOM/runtime đạt 8/8, native firmware host harness compile và chạy thành công, và
full ESP32 firmware compile thành công với FQBN bắt buộc. Không service vận hành,
MongoDB production, MQTT vận hành, firmware upload hoặc bơm vật lý nào được dùng.

## 2. Input And Archive Verification

Nguồn chuẩn:

- ZIP: `D:\Download\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REVIEW.zip`
- Report tham chiếu: `D:\Download\CODEX_PHASE22A_FIX1_FINAL_REPORT.md`
- Thư mục kiểm tra sạch: `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT`

Kết quả ZIP đầu vào:

| Check | Result |
|---|---|
| Expected SHA-256 | `4661c0577222bbb2dca45b2c935ac5a1eb23e52296393d0dad3a1ffd53cefaea` |
| Actual SHA-256 | `4661C0577222BBB2DCA45B2C935AC5A1EB23E52296393D0DAD3A1FFD53CEFAEA` |
| Expected size | 231028 bytes |
| Actual size | 231028 bytes |
| Expected inventory | 132 entries |
| Actual inventory | 132 entries |
| Archive integrity | PASS, exit code 0 |
| Forbidden entries | 0 |

Không có `.git/`, `node_modules/`, `.env`, `Secrets.h`, credential, token,
database dump, build output, cache, temporary file hoặc archive cũ trong ZIP đầu vào.

## 3. Scope Status

| Requirement | Status | Evidence |
|---|---|---|
| Verify input ZIP hash, integrity, inventory and exclusions | Completed | Hash, size and 132-entry inventory match exactly |
| Re-audit delayed retry freshness | Completed | Production-path tests and source review pass |
| Re-audit failed/stuck processing resume | Completed after Fix 2 | Concurrent expired-lease race reproduced, fixed and regression-tested |
| Re-audit Shadow daily-dose parity | Completed | Shadow imports and calls Phase 21 `getDailyDoseUsage()` |
| Executable firmware host tests | Completed | Compile and execution exit code 0 |
| Executable Dashboard DOM/runtime tests | Completed | 8 pass, 0 fail, production `public/app.js` executed in VM DOM harness |
| Full backend regression suite | Completed | 173 pass, 0 fail, 0 skip |
| JavaScript syntax checks | Completed | 43 pass, 0 fail |
| Full Arduino firmware compile | Completed | Exit code 0 with required FQBN |
| Operational MongoDB/MQTT/runtime test | Not run by design | Explicit safety restriction |
| Firmware upload and hardware test | Not run by design | Compile-only task; no ESP32 or pump operation |
| Phase 22B implementation | Not done | Explicitly outside scope |

## 4. Finding And Fix

### 4.1 Reproduction Before Fix 2

The new production-path regression test was first run against Fix 1 source:

```text
node --test test/phase22aFix1.test.js
tests 6, pass 5, fail 1, skipped 0, exit code 1
Failure: two concurrent retries cannot both claim an expired PROCESSING row
Assertion: expected accepted count 1, actual 2
```

An independent instrumentation run also observed:

```json
{
  "telemetry": [
    { "accepted": true, "reason": "ACCEPTED" },
    { "accepted": true, "reason": "ACCEPTED" }
  ],
  "sensorLogs": 1,
  "shadowDecisions": 1,
  "processingState": "COMPLETED"
}
```

Root cause: the expired-row claim filter only required
`processingState: "PROCESSING"`. The first claimer renewed the lease but kept the same
state, so the second concurrent update could still match and enter the pipeline.

### 4.2 Fix 2

For an expired row, the atomic claim now requires:

- `processingState: "PROCESSING"`
- `processingLeaseUntil <= now`
- the exact observed `processingAttempt`

Failed rows still require `processingState: "FAILED"`; legacy stuck rows require the
absence of `processingState` plus `telemetryOrderStatus: "PROCESSING"`. A losing retry
falls into the existing idempotent duplicate path.

After the fix:

```text
node --test test/phase22aFix1.test.js
tests 6, pass 6, fail 0, skipped 0, exit code 0
```

The test verifies one accepted retry, one duplicate retry, one sensor log, one Shadow
decision, zero dosing runs, `processingAttempt: 2`, and final state `COMPLETED`.

## 5. Audit Of The Four Fix 1 Areas

### 5.1 Delayed Retry Freshness

Status: PASS.

- Measurement time uses a prior same-boot uptime anchor.
- A new receipt timestamp is not accepted as proof that an old measurement is fresh.
- No-anchor timing is labeled `NO_SAME_BOOT_UPTIME_ANCHOR` and fails control freshness.
- Invalid/unverified timing is excluded from TDS stability.
- The first measurement in a boot cannot count toward three-measurement stability; the
  production pipeline requires packets 2, 3 and 4 after packet 1 establishes the anchor.
- ESP32 32-bit `millis()` rollover is explicitly tested and passes.
- Duplicate receipt updates duplicate audit fields only; it does not replace the original
  `measurementAt` or promote the row into stability/control.

### 5.2 Failed Or Stuck PROCESSING Resume

Status: PASS after Fix 2.

- Mid-pipeline errors mark the existing row `FAILED` with error code and failed time.
- Retry reclaims the same row; no second sensor log is inserted.
- Persisted accepted order/session decisions are reused.
- Pre-Fix-1 legacy stuck rows can resume.
- Expired processing leases now use atomic lease/attempt compare-and-set.
- Two near-concurrent retries produce one processing owner and one idempotent duplicate.
- Duplicate-key errors remain idempotent.
- Retry/duplicate paths create no dosing run and publish no pump command.

### 5.3 Shadow Daily-Dose Parity

Status: PASS.

- `shadowDosingService.js` imports Phase 21 `getDailyDoseUsage()` directly.
- The same local-day/manual-reset window and statuses `in_progress`, `mixing_wait`, and
  `completed` are used.
- No parallel daily-dose implementation exists in Shadow.
- The daily-limit gate remains fail-closed.
- Shadow imports no MQTT client or pump publisher and has no dosing-run writer.
- Shadow forces its settings view to `enabled: false` and cannot enable Auto Dosing.

### 5.4 Executable Firmware And Dashboard Tests

Status: PASS.

- Native harness includes production `TelemetrySequence.h` and
  `TelemetryPublishState.h`.
- It tests sequence increment, rollover, retry identity/payload retention, and reset after
  successful publish.
- Dashboard tests execute production `public/app.js` using `vm.runInContext` and a DOM
  harness, rather than relying only on source-string assertions.
- V2 rendering, safe legacy fallback, Auto Dosing OFF, Shadow reason rendering, and absent
  hypothetical values are tested without `undefined` or `NaN` output.

## 6. Files Modified Or Created

### Source package

| File | Change and purpose |
|---|---|
| `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js` | Fix atomic claim ownership for failed/expired/stuck processing rows, especially concurrent expired-lease retries |
| `03_Edge_Server/mqtt_backend/test/phase22aFix1.test.js` | Add reproducible concurrent expired-lease regression test |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Record Fix 2 defect, verification, compile and safety state |

### Handoff artifacts

| File | Purpose |
|---|---|
| `D:\Download\CODEX_PHASE22A_FIX2_FINAL_REPORT.md` | This consolidated independent audit report |
| `D:\Download\Hydroponic_IoT_ESP32_PHASE22A_FIX2_REVIEW.zip` | Final secret-safe source archive |

No ESP32 firmware source, GPIO mapping, MQTT logic, pump logic, calibration lifecycle,
Auto Dosing logic, Dashboard production source, or database schema was modified in Fix 2.

## 7. Before And After Logic

Before:

```text
expired row -> filter by PROCESSING state only
first retry renews lease but keeps PROCESSING
second retry still matches -> both process
```

After:

```text
expired row -> filter by PROCESSING + expired lease + observed attempt
first retry renews lease and increments attempt
second retry no longer matches -> idempotent duplicate path
```

This preserves resumability while making ownership exclusive. It does not weaken any
freshness, order, calibration, stability, Shadow, or Auto Dosing gate.

## 8. Test And Tool Results

### Environment

- OS shell: Windows PowerShell
- Node.js: `v24.12.0`
- npm: `11.6.2`
- g++: WinLibs MinGW-W64 UCRT POSIX SEH `16.1.0`
- Arduino CLI: `1.5.1`, commit `01f3d4f2b`
- ESP32 core: `esp32:esp32 3.3.10`
- ArduinoJson: `7.4.3`
- DallasTemperature: `4.0.6`
- OneWire: `2.3.8`
- PubSubClient: `2.8`

### Dependency install

```text
Command: npm ci
Result: 132 packages added; 133 packages audited
Exit code: 0
```

`npm audit` reports two indirect dependency findings: `body-parser` low and
`ip-address` high. No automatic dependency upgrade was made because it was outside this
safety fix and could change runtime dependencies without a dedicated compatibility audit.

### Full backend suite

```text
Command: npm test
Runner: node --test
Tests: 173
Pass: 173
Fail: 0
Skipped: 0
Cancelled: 0
Todo: 0
Duration: 1124.7401 ms
Exit code: 0
```

The output includes the expected test-only warning for a deliberately invalid telemetry
identity and an ephemeral Express server on port 0; neither is a test failure or an
operational service startup.

### JavaScript syntax

```text
Command: node --check <each .js under src, public, test, testSupport, scripts>
Files checked: 43
Pass: 43
Fail: 0
Exit code: 0
```

No lint or typecheck script is defined in `package.json`; both are `NOT AVAILABLE`, not
reported as passed.

### Dashboard DOM/runtime

```text
Command: node --test test/dashboardContract.test.js
Tests: 8
Pass: 8
Fail: 0
Skipped: 0
Exit code: 0
```

### Native firmware host harness

```text
Compile: g++ -std=c++17 -Wall -Wextra -Werror \
  -I D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT\02_ESP32_Main_Firmware\Hydroponic_Device001 \
  test\fixtures\telemetry_firmware_host_test.cpp -o <temporary-executable>
Compile exit code: 0
Run exit code: 0
```

### Isolated migration dry-run

```text
Command: node --test --test-name-pattern="migration dry-run performs no writes" test/stabilityMigration.test.js
Tests: 1
Pass: 1
Fail: 0
Writes: 0
Exit code: 0
```

The operational migration command was not run because it connects to MongoDB even in
default dry-run mode. Source inspection confirms writes occur only when `--apply` is
present. No production or live database was accessed.

### Diff hygiene

The source ZIP intentionally contains no `.git` metadata, so normal `git status` and
repository `git diff --check` are not applicable. A SHA-256 comparison against a second
clean extraction identified only the two intended source/test changes before the status
report update. `git diff --no-index --check` emitted no whitespace-error findings; its
exit code was 1 solely because differences exist. LF-to-CRLF advisory warnings were noted.

## 9. Full ESP32 Firmware Compile

Exact FQBN:

```text
esp32:esp32:esp32:UploadSpeed=921600,CPUFreq=240,FlashFreq=80,FlashMode=qio,FlashSize=4M,PartitionScheme=default,DebugLevel=none,PSRAM=disabled,LoopCore=1,EventsCore=1,EraseFlash=none,JTAGAdapter=default,ZigbeeMode=default
```

Compile command:

```text
"D:\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile \
  --fqbn <exact-FQBN-above> \
  --build-path D:\Hydroponic_PHASE22A_FIX2_BUILD_20260810 \
  D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT\02_ESP32_Main_Firmware\Hydroponic_Device001
```

Result:

| Metric | Result |
|---|---|
| Compile exit code | 0 |
| Flash | 943700 / 1310720 bytes, 71% |
| Static RAM | 47208 / 327680 bytes, 14% |
| RAM remaining | 280472 bytes |
| Compiler warnings/errors | None reported |
| Upload | Not run |

A temporary `Secrets.h` containing only compile placeholders was created from the example
contract and deleted from the source immediately after compile. It is not in the source ZIP.

## 10. Safety And Regression Verification

### GPIO

Static source and tests confirm unchanged assignments:

| Function | GPIO |
|---|---:|
| TDS | 34 |
| DS18B20 | 4 |
| Water level | 27 |
| Main pump | 25 |
| Pump A | 26 |
| Pump B | 14 |
| Spare | 33 |

### Auto Dosing and Shadow

- `PHASE22_AUTO_DOSING_LOCKED_OFF = true` remains in production config.
- Production settings update rejects `enabled: true` during Phase 22A.
- Production evaluator and pump-status continuation exit before publisher use.
- `mqttClient.js` does not call Auto Dosing evaluation.
- Shadow imports no MQTT client or publisher.
- Shadow has no write method for `dosing_runs`.
- An `ELIGIBLE` Shadow decision remains hypothetical and sends zero command.

### Telemetry and indexes

- Duplicate, out-of-order, old-boot, unconfirmed-boot, invalid identity, and legacy rows
  remain fail-closed for control/stability/latest updates.
- `sensor_logs` retains the partial unique index on `{deviceId, measurementId}` for valid
  schema V2 identity rows.
- `shadow_dosing_decisions` retains the unique index on `{deviceId, measurementId}`.
- Boot transition remains a two-packet confirmation policy.
- The firmware MQTT packet buffer remains 1024 bytes; the representative maximum V2
  payload plus topic passes the buffer test.

## 11. Evidence File And Line References

- Freshness anchor and no-anchor fail-closed:
  `src/services/sensorLogService.js:99`, `:113`, `:118`, `:136`.
- Stability rejects unverified measurements:
  `src/services/tdsQualityService.js:90`, `:98`, `:115`, `:148`.
- Atomic Fix 2 claim filters:
  `src/services/sensorLogService.js:217`, `:230`, `:236`, `:240`.
- Concurrent regression test:
  `test/phase22aFix1.test.js:154`.
- Shared Phase 21 daily usage:
  `src/services/shadowDosingService.js:8`, `:34` and
  `src/services/autoDosingService.js:433`.
- Auto Dosing hard lock:
  `src/config/phase22Config.js:8`,
  `src/services/autoDosingService.js:166`, `:604`, `:1036`.
- Production Dashboard execution:
  `test/dashboardContract.test.js:43`, `:101`, `:108`, `:128`.
- Native production-header harness:
  `test/phase22TelemetryIdentity.test.js:227-240` and
  `test/fixtures/telemetry_firmware_host_test.cpp`.
- Unique indexes:
  `src/mongoClient.js:58-64`, `:124-126`.
- GPIO and packet buffer:
  `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h:12-20`, `:49`.

## 12. Runtime State, Risks And Limitations

- Firmware: full compile passed; not uploaded and not tested on a physical ESP32 in this audit.
- Backend: full isolated suite passed; operational service was not started.
- Dashboard: DOM/runtime harness passed; no live browser connected to operational services.
- Database: fake repository tests passed; production MongoDB and production indexes were not accessed.
- MQTT: no operational broker connection and no publish occurred.
- Hardware: no sensors or pumps were connected or operated.
- Remaining dependency risk: one indirect low and one indirect high npm advisory require a
  separate dependency compatibility/security task.
- Shadow thresholds and telemetry behavior still require Phase 22B isolated staging evidence.
- No claim is made for long-running cultivation or production autonomy.

## 13. Next Work, In Priority Order

1. Prepare an isolated Phase 22B staging MongoDB database and MQTT broker.
2. Keep Auto Dosing OFF and nutrient bottles disconnected.
3. Upload the compiled firmware to a staging ESP32 only after reviewing this Fix 2 archive.
4. Verify boot transition, delayed retry, duplicate idempotency, order rejection, and three
   distinct fresh measurements with real telemetry.
5. Verify Shadow decision history and Dashboard rendering against staging data.
6. Run a separate dependency-security review for the two indirect npm advisories before
   any production deployment.

## 14. Final Archive

- File: `D:\Download\Hydroponic_IoT_ESP32_PHASE22A_FIX2_REVIEW.zip`
- SHA-256: `A78BE02F7625A9968235C573221403716269CC8C3316EEDE46EA80640077E211`
- Size: 225030 bytes
- Inventory: 132 entries, comprising 100 files and 32 directory entries
- Integrity read: PASS, 0 errors
- Forbidden entries: 0
- Secret scan: 0 forbidden files, 0 suspicious credential-pattern hits

The ZIP excludes `.git`, `node_modules`, `.env`, `Secrets.h`, credentials, tokens,
database dumps, build/dist/coverage/cache output, temporary files, old compressed archives,
and IDE user-specific settings. `.env.example` and `Secrets.h.example` remain as intended.

## 15. Mandatory Safety Confirmations

| Confirmation | Status |
|---|---|
| Auto Dosing remains OFF. | CONFIRMED |
| Shadow Mode sent zero pump commands. | CONFIRMED |
| Shadow Mode created zero dosing runs. | CONFIRMED |
| Duplicate telemetry did not contribute to stability. | CONFIRMED |
| Out-of-order telemetry did not contribute to stability or control. | CONFIRMED |
| Legacy telemetry remained control-ineligible. | CONFIRMED |
| Delayed retry did not become fresh from a new server receipt time. | CONFIRMED |
| Failed/stuck PROCESSING telemetry resumed without a second sensor log. | CONFIRMED |
| Two concurrent expired-lease retries had exactly one processing owner. | CONFIRMED |
| Shadow daily-dose accounting used Phase 21 logic. | CONFIRMED |
| Full post-Fix-1 Arduino firmware compile passed. | CONFIRMED |
| No production database was accessed. | CONFIRMED |
| No operational MQTT message was published. | CONFIRMED |
| No calibration set was activated or retired. | CONFIRMED |
| Firmware was not uploaded to hardware. | CONFIRMED |
| No physical pump was operated. | CONFIRMED |
| Report and archive contain no secret. | CONFIRMED |
| Ready for Phase 22B staging preparation. | CONFIRMED |

Final conclusion: `PASS - READY FOR PHASE 22B STAGING PREPARATION`.
