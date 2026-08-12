# Source Consolidation Provenance

## Directory Roles Before Cleanup

| Directory | Verified role |
|---|---|
| `D:\Hydroponic_IoT_ESP32` | Original Git repository and final source of record. Its history was preserved. |
| `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_ORIGINAL_COMPARE` | Source comparison snapshot through Phase 22A Fix 1. No Git metadata or dependencies. |
| `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT` | Latest pre-consolidation source through Phase 22B Stage 1 Preflight. No Git metadata; contained runtime/dependencies that were excluded. |
| `D:\Hydroponic_PHASE22A_FIX2_BUILD_20260810` | Arduino compile output only. |
| `D:\Hydroponic_PHASE22B_STAGE1_BUILD_20260810` | Arduino USB Stage 1 compile output only. |
| `D:\Hydroponic_STAGE1_PATCH_REPO` | Temporary Git repository used to generate the Stage 1 patch. Its only commit was `2a32628 baseline`. |
| `D:\Hydroponic_STAGE1_PREFLIGHT_BASELINE` | Hash baseline immediately before Stage 1; contained Phase 22A Fix 2 plus Stage 0. |

Roles were established from directory inventory, Git metadata, SHA-256 manifests, and
path-by-path diffs. Names and modification timestamps were not used as the deciding evidence.

## Accepted Change Lineage

### Phase 22A Fix 2 PASS

Phase 22A/Fix 1 source came from `...ORIGINAL_COMPARE`. Fix 2 was verified against
`D:\Download\Hydroponic_IoT_ESP32_PHASE22A_FIX2_REVIEW.zip`. Fix 2 changed only:

- `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js`
- `03_Edge_Server/mqtt_backend/test/phase22aFix1.test.js`
- `00_Docs/PROJECT_STATUS_REPORT.md`

The status report for this checkpoint was read directly from the verified ZIP entry, without
creating another extracted source tree. The original main-only `CODEX_PHASE22A_FINAL_REPORT.md`
was retained as historical evidence.

Git checkpoint: tag `phase22a-fix2-pass`.

### Phase 22B Stage 0 PASS

Stage 0 came from `D:\Hydroponic_STAGE1_PREFLIGHT_BASELINE`, after separating the three Fix 2
files above. It added the `staging/` lifecycle/configuration, `runStage0Checks.js`,
`stage0Safety.test.js`, backend HTTP/publisher/service locks, staging documentation, package
script, `.gitignore` runtime exclusion, and Stage 0 status/report updates.

Git checkpoint: tag `phase22b-stage0-pass`.

### Phase 22B Stage 1 Preflight PARTIAL

Stage 1 came from `D:\Hydroponic_IoT_ESP32_PHASE22A_FIX1_REAUDIT`, using the exact
baseline-to-reaudit diff. It added:

- `BuildProfile.h`, `ActuatorSafety.h`, and `SecretsStage1.h.example`
- Profile-specific firmware topics and fail-closed actuator enforcement
- Conditional MQTT pump-command subscription
- Authenticated loopback/private-LAN broker lifecycle and ACL staging scripts
- Stage 1 integration and native actuator-lock tests
- Stage 1 report and patch

Consolidation then made five explained changes: stronger `.gitignore` rules and explicit
`RESERVED/UNUSED` documentation/test coverage for the Stage 1 alert topic. No sensor,
calibration, dosing, pump-command, or payload behavior was changed by consolidation.

Git checkpoint: tag `phase22b-stage1-preflight-partial`.

## Artifact Relocation

Reports are stored in `00_Docs/Phase_Reports/`, patches in `00_Docs/Patches/`, and manifests
in `00_Docs/Manifests/`. `ARTIFACT_TRANSFER_HASHES.csv` proves each retained copy matches its
source SHA-256. External files under `D:\Download` were copied for preservation but are outside
the authorized deletion scope and were not deleted.

## Source Parity

`STAGE1_SOURCE_PARITY.csv` compares 127 eligible files from the latest pre-consolidation tree:

- 122 exact SHA-256 matches after report/patch path mapping.
- 5 explained consolidation changes.
- 0 missing files.
- 0 unexplained differences.

Runtime data, credentials, `.env`, `Secrets.h`, dependencies, logs, binaries, caches, and ZIP
archives were intentionally excluded from the source merge.
