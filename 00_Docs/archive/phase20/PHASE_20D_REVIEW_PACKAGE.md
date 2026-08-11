# HISTORICAL SNAPSHOT — DO NOT USE FOR CURRENT PHASE 21 SAFETY LOGIC.

This snapshot preserves later Phase 20B/20C runtime evidence. It is historical
evidence only, not Phase 21 runtime validation. Current project state and safety
requirements are authoritative in `00_Docs/PROJECT_STATUS_REPORT.md` and the
active Phase 21 documentation.

# PHASE 20D REVIEW PACKAGE - Hydroponic_IoT_ESP32

## 1. Summary of Documentation Updates

Phase 20D is a documentation-only phase. It records the user-confirmed runtime PASS results for Phase 20B and Phase 20C and prepares polished Vietnamese material for the thesis/report and supervised demonstration.

Documented runtime status:

- Phase 20B: PASS runtime prototype.
- Phase 20C: PASS runtime prototype.
- Auto Dosing V2: functional for conservative, supervised, small-step dosing.
- Auto Dosing: disabled by default.

Key verified real-nutrient result:

| Field | Result |
|---|---|
| Mode | `closed_loop_step` |
| Status | `completed` |
| TDS at start | 302.27 ppm |
| TDS after mixing | 348.88 ppm |
| Delta TDS | +46.61 ppm |
| Dose | 1 ml Pump A + 1 ml Pump B |
| Pump A | 500 ms, completed |
| Pump B | 556 ms, completed |
| Mixing delay | 15 minutes |
| Water level after mixing | `normal` |
| Result | `positive_response` |

## 2. Files Modified and Created

Modified:

- `00_Docs/PROJECT_STATUS_REPORT.md`
- `03_Edge_Server/mqtt_backend/README.md`

Created:

- `00_Docs/PHASE_20B_20C_REPORT_INSERT.md`
- `00_Docs/DEMO_CHECKLIST_AUTO_DOSING.md`
- `00_Docs/PHASE_20D_REVIEW_PACKAGE.md`

No duplicate status file or README was created.

The working tree also contains Phase 20C code changes from the immediately preceding implementation task. Those existing changes were not edited during Phase 20D. Phase 20D itself touched only the five documentation files listed above.

## 3. Key Report Sections Added

`PROJECT_STATUS_REPORT.md` now includes:

- Phase 20B closed-loop runtime validation table.
- Phase 20C monitoring/export runtime validation table.
- Real nutrient one-step result table.
- Verified safety mechanisms.
- Final Phase 20B/20C status.
- Current limitations and recommended next direction.

`README.md` now includes:

- Phase 20B/20C runtime PASS status.
- Runtime-verified feature list.
- Required warning that Auto Dosing remains disabled by default.
- Recommended conservative operating settings.
- Nutrient Response Test 4 results.
- Real nutrient Auto Dosing V2 result.

`PHASE_20B_20C_REPORT_INSERT.md` provides polished Vietnamese report content:

1. Continuous main-pump control.
2. Pump A/B continuous-command rejection.
3. Nutrient Response Test 4.
4. Auto Dosing V2 closed-loop step dosing.
5. Real nutrient one-step result.
6. Verified safety mechanisms.
7. Phase 20C monitoring dashboard.
8. Technical observations and limitations.
9. Hybrid Local-first conclusion.

`DEMO_CHECKLIST_AUTO_DOSING.md` provides:

- Pre-demo safety checks.
- Manual pump demonstration steps.
- Safe Auto Dosing V2 settings and sequence.
- Monitoring and CSV export demonstration.
- Post-demo shutdown and evidence capture.

## 4. Confirmation of Code Scope

Phase 20D did not change:

- ESP32 firmware.
- Backend services, routes, validators, or database logic.
- Dashboard HTML, CSS, or JavaScript.
- MQTT topics or pump-command protocol.
- MongoDB schema or records.
- Auto Dosing settings or runtime state.
- Pump calibration or TDS calibration logic.

No Auto Dosing run was started. Auto Dosing was not enabled. No database record was deleted or modified by this documentation task.

## 5. Static Documentation Checks

Checks performed:

- Required modified and created Markdown files exist.
- Required headings and runtime PASS tables are present.
- Vietnamese report text is stored without the mojibake sequences from the source request.
- Documentation diff passes `git diff --check`.
- Review package contains no `.env` value, Wi-Fi credential, MongoDB URI, password, token, or API key.
- Scope review confirms Phase 20D changes are limited to the five requested documentation files.

## 6. Notes for Reviewer

The previous `PHASE_20B_REVIEW_PACKAGE.md` and `PHASE_20C_REVIEW_PACKAGE.md` are retained as historical snapshots. Their earlier `NOT TESTED` statements reflect the state when those packages were generated. The authoritative current runtime status is recorded in:

- `00_Docs/PROJECT_STATUS_REPORT.md`
- `03_Edge_Server/mqtt_backend/README.md`
- This Phase 20D review package

Safety conclusion:

> Auto Dosing must remain disabled by default. Enable only during supervised tests or controlled operation.

Recommended current prototype settings:

```text
stepDoseMlPerPump = 1
maxDoseMlPerPumpPerRun = 1
maxDailyDoseMlPerPump = 1 or 2
mixingDelayMs = 900000 for real nutrient operation
requireMainPumpOn = true
```

Pump A/B remain pulse-only. Main pump continuous ON may be used for circulation and mixing. Large one-shot dosing is outside the validated scope.

For ChatGPT review, send only this file:

```text
00_Docs/PHASE_20D_REVIEW_PACKAGE.md
```
