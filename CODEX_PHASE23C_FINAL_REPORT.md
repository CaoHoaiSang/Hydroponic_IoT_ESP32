# CODEX PHASE 23C FINAL REPORT

## 1. Scope And Objective

Phase 23C replaces the React Auto Dosing placeholder with read-only Backend monitoring and
documents a fail-closed way to reduce continuous SEN0244 energized exposure. The dashboard now
shows saved settings, readiness, daily usage, active/latest runs, events, and nutrient response.
It refreshes every five seconds and has no settings-write, enable, dosing, or pump-command path.

EC probe duty cycling is designed but intentionally not activated. Current hardware supplies the
SEN0244 directly from ESP32 5V, so software-only ADC scheduling cannot switch probe power.

## 2. Requirement Status

| Requirement | Status | Evidence |
|---|---|---|
| React Auto Dosing settings/readiness integration | Complete | Real Stage 1 rendering and automated tests pass |
| Active/latest runs, daily usage, events, nutrient response | Complete | Eight GET endpoints normalized by one adapter snapshot |
| Five-second refresh and refresh error state | Complete | Timer, in-flight guard, retained last successful snapshot |
| Read-only/fail-closed UI | Complete | Disabled switch/inputs; no PUT/POST method added |
| Independent Backend regression | Complete | 219/219 pass |
| EC probe duty-cycle safety design | Complete | Hardware, states, triggers, watchdog, payload, gates documented |
| EC probe power-switch hardware | Not done | Exact high-side circuit and GPIO are not approved/installed |
| Duty-cycle firmware and physical validation | Not done | Correctly blocked by missing hardware approval |
| Firmware upload or actuator operation | Not performed | Out of scope and unnecessary for this frontend/docs phase |

## 3. Files Created Or Modified

| File | Purpose |
|---|---|
| `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md` | Hardware-gated probe power-cycle design and acceptance gates |
| `CODEX_PHASE23C_FINAL_REPORT.md` | Consolidated handoff evidence |
| `03_Edge_Server/frontend/src/adapters/types.ts` | Monitoring data contracts |
| `03_Edge_Server/frontend/src/adapters/index.ts` | Export monitoring contracts |
| `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.ts` | Aggregate and normalize eight GET endpoints |
| `03_Edge_Server/frontend/src/App.tsx` | Runtime Auto Dosing view, refresh, error, history, and lock display |
| `03_Edge_Server/frontend/src/styles.css` | Responsive run/event lists |
| `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.test.ts` | GET-only adapter contract test |
| `03_Edge_Server/frontend/tests/playwright/frontend-acceptance.spec.ts` | Browser rendering and lock test |
| `README.md` | Current Phase 23C summary |
| `README_HYDROFLOW_LOCAL.md` | Local UI monitoring behavior |
| `00_Docs/PROJECT_PLAN.md` | Phase 23C roadmap entry |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Current status, risks, files, and next gate |

No ESP32 firmware, backend service logic, MQTT publisher, route, MongoDB service, calibration
logic, pump logic, or official pin-map file was modified.

## 4. Logic Before And After

Before: the React Auto Dosing page displayed local placeholder values, hardcoded failed checks,
empty history, and text saying Backend settings/readiness were not integrated.

After: the page gets one normalized monitoring snapshot from existing Backend APIs. Every five
seconds it refreshes settings, readiness, active run, 10 recent runs, daily usage, 10 events,
24-hour event summary, and latest nutrient response. A transient failure keeps the previous good
snapshot visible and exposes an error state. Backend reason codes remain visible through operator
labels. The switch and form remain disabled.

For EC protection, the previous physical behavior is unchanged. The approved design boundary is
now explicit: only a reviewed 5V high-side switch can power-cycle the SEN0244. The future state
machine defaults OFF, invalidates TDS while off/warming/sampling, limits sensor-on time, and can
request measurements on a schedule or after the existing mixing delay. Measurement triggers can
never directly publish pump commands.

## 5. Technical Decisions

- Reused existing GET APIs instead of duplicating backend data or adding routes.
- Kept the React adapter GET-only so monitoring cannot become an actuator path.
- Used Backend readiness as authority; frontend percentages are only a grouped visualization.
- Retained the last successful snapshot during refresh errors to avoid flicker and fake defaults.
- Did not assign proposed GPIO32 because official pin changes require circuit review and explicit
  approval.
- Did not power the sensor from GPIO or a 12V pump MOSFET channel; both are electrically unsafe
  for the current 5V sensor supply contract.
- Did not compile firmware because no firmware source changed.

## 6. Verification Results

### Frontend Full Verification

Command:

```powershell
cd 03_Edge_Server\frontend
npm run verify
```

Exit code: `0`.

- ESLint: pass.
- TypeScript `tsc --noEmit`: pass.
- Vitest: 2 files, 7 tests passed, 0 failed.
- Vite production build: pass, 1,584 modules transformed.
- Output: CSS 133.07 kB, JS 337.03 kB before gzip.

### Browser Acceptance

Command: `npm run test:e2e`

Exit code: `0`. Result: 27 passed, 0 failed. The new test verifies real API fixture values,
run/event history, disabled Auto Dosing switch, `aria-checked=false`, and zero enabled inputs.
Existing direct routes, fail-closed controls, outage recovery, stale state, and six viewport
overflow checks also pass.

### Backend Regression

Command:

```powershell
cd 03_Edge_Server\mqtt_backend
npm test
```

Exit code: `0`. Result: 219 passed, 0 failed, 0 skipped.

### JavaScript Syntax And Diff

- Command: `node --check <each backend .js file>`.
- Result: 58 files checked, 0 failures, exit code `0`.
- Command: `git diff --check`.
- Result: pass, exit code `0`; Windows emitted expected LF-to-CRLF notices only.
- Secret-pattern review of current diff: no Wi-Fi password, MongoDB SRV URI, token, or known
  runtime credential found.

### Isolated Stage 1 Read-Only Runtime

The already-running isolated service was queried on loopback; no service was started or reset.

- `/health`: Backend, MongoDB, and MQTT connected.
- Capabilities: `actuatorsLocked=true`, `pumpCommandsEnabled=false`,
  `autoDosingCanEnable=false`.
- Settings: `enabled=false`.
- Readiness: blocked by `main_pump_not_running` and `tds_measurement_stale`.
- Dosing runs: `0`; active run: `null`; Auto Dosing events: `0`.
- Dashboard screenshot inspection: correct settings 800-900 ppm, 1 ml step, 2 ml/day,
  15-minute mixing, 75% grouped readiness, disabled switch, and empty histories.
- Stage 1 LAN MQTT listener was not reachable on the machine's current network during final
  status inspection; loopback services were healthy. No ESP32/network transition was attempted.

## 7. Checks Not Run

- Firmware compile: not run because no firmware file changed.
- Firmware upload/Serial/physical test: not run; no ESP32 action was required.
- EC power-cycle test: blocked by the absent high-side switch and unapproved GPIO.
- Migration dry-run: not run because this phase has no migration or database schema change.
- `npm audit`: not rerun because dependencies were not changed; no automatic upgrade was made.

## 8. Component Status

| Component | Status |
|---|---|
| Firmware | Unchanged; existing USB Stage 1 actuator lock remains the accepted profile |
| Backend | Unchanged; 219/219 regression pass |
| React dashboard | Phase 23C implemented and browser/runtime verified |
| Database | Read-only inspection only; no schema/lifecycle/write task performed |
| MQTT | Connected on isolated loopback; no publish performed by this task |
| Auto Dosing | OFF and unable to enable from React |
| Pumps | No command or physical operation performed |
| EC probe duty cycle | Design ready; hardware and firmware not active |

## 9. Risks And Limits

- Duty cycling may reduce energized exposure but does not replace cleaning, bubble management,
  circulation, placement, or meter comparison.
- Warm-up time is provisional until measured through repeated real power cycles.
- A high-side switch must be checked for default OFF and AOUT back-powering before firmware use.
- The React aggregate refresh currently reports one combined error if any of its eight APIs fails;
  it retains the last good snapshot but the first load requires all endpoints.
- Current stale TDS and stopped main pump correctly keep readiness false.
- Existing Stage 1 runtime credentials remain ignored and are not included here.

## 10. Next Work In Priority Order

1. Select and review the exact 5V high-side switch circuit.
2. Explicitly approve one official ESP32 control GPIO and update pin/wiring documents.
3. Add disabled-by-default firmware duty-cycle profile with OFF/warm-up/sample/watchdog states.
4. Bench-test VCC OFF/ON, AOUT back-power, warm-up settling, and fault timeout with pumps locked.
5. Extend payload/backend quality fields and regression tests before any Auto Dosing consideration.
6. Run a multi-day supervised comparison against continuous-power fouling/drift.

## 11. Safety-Critical Source Evidence

- GET-only monitoring aggregation: `03_Edge_Server/frontend/src/adapters/BackendApiAdapter.ts:164`.
- Five-second refresh: `03_Edge_Server/frontend/src/App.tsx:562`.
- Disabled read-only switch and no-control description: `03_Edge_Server/frontend/src/App.tsx:594`.
- Runtime run/event histories: `03_Edge_Server/frontend/src/App.tsx:607`.
- No official probe-power GPIO yet: `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md:8`.
- Dedicated high-side switch and default OFF: `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md:21` and `:24`.
- Sensor must not be GPIO-powered: `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md:27`.
- Measurement cannot publish a pump command: `00_Docs/EC_PROBE_DUTY_CYCLE_PLAN.md:63`.

## 12. Secret And Safety Confirmation

- The changed source and this report contain no credential or secret.
- No production database, broker, or credential was used.
- No MQTT message was published.
- No pump command, dosing run, calibration activation, or Auto Dosing enable action occurred.
- No firmware upload or physical actuator operation occurred.
- Auto Dosing remains OFF.
- No official GPIO assignment was changed.

## 13. Conclusion

Phase 23C read-only Auto Dosing monitoring is **IMPLEMENTED AND VERIFIED**. EC probe duty-cycle
protection is **DESIGNED BUT HARDWARE-GATED** and must not be described as active until the
switch circuit, pin approval, firmware, and physical acceptance tests are complete.
