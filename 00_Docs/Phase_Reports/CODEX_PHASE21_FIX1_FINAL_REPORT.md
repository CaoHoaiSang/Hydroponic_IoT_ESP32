# CODEX PHASE 21 FIX ROUND 1 - FINAL REPORT

## 1. Pham vi va muc tieu

Bao cao nay tong hop dot sua sau audit doc lap Phase 21. Muc tieu la xu ly cac loi an toan P0/P1 da duoc audit chi ra, giu nguyen cac thay doi Phase 20B/20C/21 dang co trong working tree, va khong tac dong he thong van hanh.

Pham vi da thuc hien:

- Khoa hop dong cua so ADC TDS: `tdsWindowStable` chi dung khi du 30 mau va spread raw khong qua 50.
- Kiem tra lai hop dong nay tai backend, khong tin rieng co boolean tu firmware.
- Gan `measurementAt` phia server va chi cho phep danh gia sau mixing khi phep do moi hon `mixingUntil` va dung calibration set ban dau.
- Ngan tao nhieu dosing run dong thoi va ngan publish Pump B lap khi nhan status trung/lap thu tu.
- Gia co activate/retire calibration set bang transaction khi co ho tro; fallback co rollback va fail-closed.
- Mo rong migration de phan loai ca row co `calibrationSetId` nhung metadata vat ly khong day du.
- Bo sung kiem thu hanh vi bang fake MongoDB, khong ket noi database/MQTT van hanh.
- Sua tai lieu khong con mo ta cac duong calibration mot diem/hai diem, voltage fallback hoac extrapolation nhu logic dang hoat dong.

Khong nam trong pham vi:

- Khong khoi dong backend/service.
- Khong ket noi hoac ghi MongoDB van hanh.
- Khong publish/subscribe MQTT.
- Khong enable Auto Dosing.
- Khong activate/retire calibration set that.
- Khong dieu khien bom.
- Khong compile firmware do may khong co `arduino-cli`.

## 2. Trang thai tung yeu cau audit

| Yeu cau | Trang thai | Ket qua |
|---|---|---|
| P0: chan `tdsWindowStable=true` khi chua du mau | Hoan thanh | Validator va quality service deu yeu cau chinh xac 30 mau, spread raw <= 50. |
| P1: phep do sau mixing phai thuc su sau `mixingUntil` | Hoan thanh | Dung `measurementAt`; yeu cau timestamp moi hon mixing va cung active calibration set. |
| P1: chi mot dosing run active cho moi device | Hoan thanh | Unique partial `activeLock` va xu ly duplicate-key fail-closed. |
| P1: Pump B chi publish mot lan | Hoan thanh | Claim nguyen tu `pending -> publishing` bang `findOneAndUpdate` truoc publish. |
| P1: status trung/lap thu tu khong lam hong state | Hoan thanh | Update co dieu kien theo `currentStep` va trang thai mong doi; message khong lien quan bi bo qua. |
| P1: calibration lifecycle atomic | Hoan thanh o ma nguon | Transaction khi MongoDB ho tro; fallback checked-write + rollback. Chua kiem chung tren MongoDB deployment that. |
| P1: migration phat hien row legacy khong day du | Hoan thanh | Scan tat ca row, phan loai set ID/EC/scale/temperature; dry-run mac dinh. |
| P2: test helper/source-search yeu | Hoan thanh | Thay boi test service that voi fake repository; them concurrency/failure-injection tests. |
| P2: README mo ta logic cu | Hoan thanh | Active documentation chuyen sang EC-first, scale 500, 3 diem, khong extrapolation. |
| Firmware compile ESP32 | Chua kiem chung | `arduino-cli` khong duoc cai dat. |
| Backend runtime voi broker va MongoDB that | Chua kiem chung | Co chu dich khong chay de bao ve he thong van hanh. |
| Dashboard runtime tren trinh duyet | Chua kiem chung trong Fix1 | Khong khoi dong service; cac contract test Node da pass. |
| Hardware/pump runtime | Chua lam | Khong gui lenh bom va khong publish MQTT. |

Ket luan trang thai: cac loi ma nguon P0/P1 trong audit da duoc sua va qua kiem thu co lap. Phase 21 Fix Round 1 **chua duoc xac nhan hoan tat van hanh** cho den khi compile firmware va kiem thu tren moi truong staging/phan cung an toan.

## 3. File sua/tao va muc dich

### 3.1 File sua trong Fix Round 1

| File | Muc dich |
|---|---|
| `03_Edge_Server/mqtt_backend/src/config/tdsQualityConfig.js` | Them hang so 30 mau va spread raw 50. |
| `03_Edge_Server/mqtt_backend/src/validators/sensorPayloadValidator.js` | Bat buoc quan he chinh xac giua count, spread va stable. |
| `03_Edge_Server/mqtt_backend/src/services/tdsQualityService.js` | Kiem tra cua so firmware doc lap; loc history theo cung hop dong. |
| `03_Edge_Server/mqtt_backend/src/services/sensorLogService.js` | Luu `measurementAt`, count/spread va quality contract vao log/latest. |
| `03_Edge_Server/mqtt_backend/src/services/autoDosingService.js` | Sua post-mixing freshness/set identity, active-run lock, Pump B atomic va duplicate status. |
| `03_Edge_Server/mqtt_backend/src/mongoClient.js` | Them unique partial lock va hook fake DB chi trong `NODE_ENV=test`. |
| `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js` | Transaction lifecycle, checked writes, rollback fallback va fail-closed. |
| `03_Edge_Server/mqtt_backend/scripts/migrateLegacyTdsCalibrations.js` | Scan/phat hien moi dang row legacy khong day du; dry-run mac dinh. |
| `03_Edge_Server/mqtt_backend/test/autoDosingSafety.test.js` | Test helper hanh vi freshness/set thay cho source-string assertion. |
| `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js` | Test stability bien va migration zero-write/phan loai/apply. |
| `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js` | Test mismatch count/spread/stable. |
| `03_Edge_Server/mqtt_backend/README.md` | Sua huong dan EC-first va mo ta Fix1. |
| `README.md` | Tong quan Fix1 va gioi han runtime. |
| `00_Docs/PROJECT_PLAN.md` | Them Phase 21 Fix Round 1. |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Cap nhat trang thai, file, test, rui ro va buoc tiep theo. |
| `00_Docs/Database_Schema.md` | Bo sung measurement/lock/set identity. |
| `00_Docs/Payload_Format.md` | Tai lieu hoa hop dong stable chinh xac va `measurementAt`. |
| `04_Database/mongodb_schema.md` | Dong bo schema index/lock/measurement. |

### 3.2 File tao trong Fix Round 1

| File | Muc dich |
|---|---|
| `03_Edge_Server/mqtt_backend/test/phase21FixBehavior.test.js` | Test service that: post-mixing, concurrency, Pump B idempotency, lifecycle transaction/rollback. |
| `03_Edge_Server/mqtt_backend/testSupport/fakeMongo.js` | Fake MongoDB co query/update/index conflict, transaction snapshot va failure injection. |
| `CODEX_PHASE21_FIX1_FINAL_REPORT.md` | Bao cao ban giao tong hop nay. |

### 3.3 Thay doi Phase 21/working tree da co va duoc bao ton

Danh sach sau la toan bo cac file tracked dang thay doi ngoai cac muc Fix1 o tren. Chung la thay doi tich luy Phase 20B/20C/21, khong bi hoan tac trong dot sua:

- `02_ESP32_Main_Firmware/Hydroponic_Device001/Config.h`: cau hinh sampling/temperature.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Hydroponic_Device001.ino`: scheduler nonblocking.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/PayloadBuilder.cpp`: payload quality fields.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.cpp`: ring buffer TDS va DS18B20 nonblocking.
- `02_ESP32_Main_Firmware/Hydroponic_Device001/Sensors.h`: state/API sensor.
- `03_Edge_Server/mqtt_backend/.env.example`: cac nguong quality/freshness co ten.
- `03_Edge_Server/mqtt_backend/package.json`: `npm test` dung `node --test`.
- `03_Edge_Server/mqtt_backend/public/app.js`: dashboard calibration/readiness/monitoring.
- `03_Edge_Server/mqtt_backend/public/index.html`: giao dien calibration set va Auto Dosing.
- `03_Edge_Server/mqtt_backend/public/styles.css`: style dashboard.
- `03_Edge_Server/mqtt_backend/src/routes/deviceRoutes.js`: API calibration set/readiness/export.
- `03_Edge_Server/mqtt_backend/src/validators/autoDosingSettingsValidator.js`: target/crop confirmation rules.
- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationValidator.js`: EC-first point validation.
- `04_Database/sample_payload.json`: payload quality mau.

File untracked Phase 20/21 da co va duoc bao ton:

- `00_Docs/DEMO_CHECKLIST_AUTO_DOSING.md`: checklist demo an toan.
- `00_Docs/EC_TDS_Calibration.md`: huong dan EC/TDS scale 500.
- `00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md`: ghi chu cap nhat tai lieu Phase 20D.
- `00_Docs/PHASE_20B_20C_REPORT_INSERT.md`: noi dung report Phase 20B/20C.
- `00_Docs/PHASE_20C_REVIEW_PACKAGE.md`: goi review Phase 20C.
- `00_Docs/PHASE_20D_REVIEW_PACKAGE.md`: goi review Phase 20D.
- `03_Edge_Server/mqtt_backend/src/services/autoDosingEventService.js`: audit event service.
- `03_Edge_Server/mqtt_backend/src/services/autoDosingReadinessService.js`: fail-closed readiness.
- `03_Edge_Server/mqtt_backend/src/services/exportService.js`: CSV export.
- `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationSetValidator.js`: lifecycle/set/point validation.
- `03_Edge_Server/mqtt_backend/test/dashboardContract.test.js`: dashboard/API contract tests.
- `CODEX_PHASE21_FINAL_REPORT.md`: bao cao Phase 21 truoc Fix1, chi co gia tri lich su.
- `_phase21_review/git_status.txt`
- `_phase21_review/git_head.txt`
- `_phase21_review/git_diff_stat.txt`
- `_phase21_review/git_diff.patch`
- `_phase21_review/git_diff_check.txt`
- `_phase21_review/npm_test.txt`
- `_phase21_review/node_check.txt`
- `_phase21_review/migration_dry_run.txt`
- `_phase21_review/firmware_build.txt`
- `_phase21_review/changed_files.txt`
- `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip`: archive truoc Fix1; khong dung archive nay de ket luan cac sua loi Fix1.

## 4. Logic truoc va sau thay doi

### 4.1 TDS window stability

Truoc:

- Backend co the chap nhan `tdsWindowStable=true` du count bang 0 hoac khong dung nguong spread.
- Quality service tin co boolean firmware ma khong tai tinh hop dong.

Sau:

- Stable phai bang dung bieu thuc `tdsSampleCount === 30 && tdsSpreadRaw <= 50`.
- Payload khai bao sai boolean bi validator reject.
- Quality service tu kiem tra count/spread cho tung mau va lich su.

### 4.2 Post-mixing evaluation

Truoc:

- Payload cu hoac phep do truoc khi mixing ket thuc co the duoc dung de tinh delta.
- Calibration set thay doi giua run khong bi chan day du.

Sau:

- Backend gan `measurementAt` khi luu payload.
- Phep do phai moi hon `mixingUntil`, moi hon moc bat dau mixing, con fresh, va co cung `tdsCalibrationSetIdAtStart`.
- Active set hien tai phai van active/valid va co toi thieu ba diem.
- Neu khong dat, run o lai `mixing_wait`, ghi reason, khong tao delta gia va khong publish them lenh.

### 4.3 Concurrency va Pump B

Truoc:

- Hai payload dong thoi co the cung thay khong co run va tao hai run.
- Hai status Pump A completed co the cung publish Pump B.

Sau:

- Moi run active mang `activeLock=true`; unique partial index chi cho phep mot active run/device.
- Insert thua cuoc tra ve `dosing_run_active` va khong publish Pump A.
- Pump B chi duoc publish sau khi mot caller claim nguyen tu `pending -> publishing`; caller con lai bo qua.
- Hoan tat/that bai deu go `activeLock`.

### 4.4 Calibration lifecycle

Truoc:

- Activate/retire gom nhieu write tach roi; rollback khong bao phu moi giai doan.
- Co rui ro pointer, status set va Auto Dosing settings lech nhau.

Sau:

- Dung MongoDB transaction khi deployment ho tro.
- Neu transaction khong duoc ho tro, tung write duoc kiem tra matched/upsert count.
- Fallback luu state truoc thay doi va rollback target set, previous active set, pointer va dosing setting khi co loi.
- Unique `activeLock` ngan hai active calibration set cho mot device.
- Activate/retire luon ep Auto Dosing OFF; khong tu dong enable.

### 4.5 Legacy migration

Truoc:

- Query chi tim row thieu `calibrationSetId`, bo sot row co set ID nhung EC/scale/temperature khong hop le.

Sau:

- Scan tat ca row.
- Phan loai missing/empty set ID, EC invalid, scale khong phai 500, temperature invalid/85/out-of-range.
- Dry-run la mac dinh va khong ghi.
- `--apply` chi danh dau/audit row khong day du; khong suy dien scale, TDS, lifecycle status va khong activate.

## 5. Quyet dinh ky thuat va ly do

1. Dung quan he stable chinh xac thay vi chi rang buoc toi thieu: tranh firmware/backend hieu khac nhau ve mot cua so hop le.
2. Dung timestamp do backend cap: tranh tin `createdAt` tu client co the sai dong ho hoac bi lap lai.
3. Ghi set ID vao dosing run: moi delta sau mixing phai cung he quy chieu calibration.
4. Dung unique partial lock: database la diem phan xu cuoi cung cho race giua cac callback async.
5. Claim Pump B truoc publish: MQTT publish la side effect khong transaction; state `publishing` dam bao chi mot caller duoc phep tao side effect.
6. Uu tien transaction, fallback co bu tru: MongoDB Atlas/replica set co transaction, nhung local standalone co the khong; fallback van phai fail-closed.
7. Migration khong suy dien du lieu vat ly: row legacy khong du bang chung de gan scale 500 hoac EC reference.
8. Fake repository thay vi database that: cho phep test race/failure injection ma khong cham du lieu van hanh.

## 6. Ket qua test, syntax check, migration va build

### 6.1 Node test suite

Thu muc: `03_Edge_Server/mqtt_backend`

Lenh:

```powershell
npm test
```

Script thuc thi:

```text
node --test
```

Ket qua cuoi:

```text
tests: 62
pass: 62
fail: 0
cancelled: 0
skipped: 0
todo: 0
duration_ms: 388.3673
exit code: 0
```

Pham vi test gom validation diem/set, EC conversion/interpolation, ngoai range, legacy isolation, stability, quan he payload, readiness fail-closed, mixing, pump sequence, race/duplicate status, lifecycle transaction/rollback va migration.

### 6.2 Node syntax check

Lenh PowerShell:

```powershell
$files = Get-ChildItem -Path src,public,scripts,test,testSupport -Recurse -File -Filter *.js
foreach ($file in $files) { node --check $file.FullName }
```

34 file da kiem tra:

```text
public/app.js
scripts/migrateLegacyTdsCalibrations.js
src/config/tdsQualityConfig.js
src/httpServer.js
src/index.js
src/mongoClient.js
src/mqttClient.js
src/routes/deviceRoutes.js
src/services/alertService.js
src/services/autoDosingEventService.js
src/services/autoDosingReadinessService.js
src/services/autoDosingService.js
src/services/deviceQueryService.js
src/services/exportService.js
src/services/nutrientResponseService.js
src/services/pumpCalibrationService.js
src/services/pumpCommandService.js
src/services/pumpLogService.js
src/services/sensorLogService.js
src/services/tdsCalibrationService.js
src/services/tdsQualityService.js
src/validators/autoDosingSettingsValidator.js
src/validators/nutrientResponseTestValidator.js
src/validators/pumpCalibrationValidator.js
src/validators/pumpCommandValidator.js
src/validators/sensorPayloadValidator.js
src/validators/tdsCalibrationSetValidator.js
src/validators/tdsCalibrationValidator.js
test/autoDosingSafety.test.js
test/dashboardContract.test.js
test/phase21FixBehavior.test.js
test/stabilityMigration.test.js
test/tdsCalibration.test.js
testSupport/fakeMongo.js
```

Ket qua:

```text
NODE_CHECK_TOTAL=34
NODE_CHECK_FAILED=0
exit code: 0
```

### 6.3 Migration dry-run co lap

Lenh:

```powershell
node --test --test-name-pattern="migration dry-run performs no writes" test/stabilityMigration.test.js
```

Ket qua:

```text
matching tests: 1
pass: 1
fail: 0
duration_ms: 258.7153
exit code: 0
database writes: 0
```

Day la fake database trong bo test. Khong doc `.env`, khong mo MongoDB URI va khong ket noi database van hanh.

Lenh migration that duoc thiet ke dry-run mac dinh:

```powershell
node scripts/migrateLegacyTdsCalibrations.js
```

Lenh tren **khong duoc chay voi database van hanh trong dot nay**. Che do ghi chi co khi nguoi van hanh chu dong them `--apply` sau review/backup.

### 6.4 Git diff check

Lenh:

```powershell
git diff --check
```

Ket qua: exit code 0, khong co whitespace error. Git chi canh bao line ending LF co the doi sang CRLF tren Windows.

### 6.5 Tim duong logic cu

Da tim trong backend README va active control-service cho cac mau latest-10 calibration, raw-voltage fallback, one/two-point reuse va extrapolation. Khong tim thay duong active control cu. Cac tu nhu `extrapolation` con lai chi nam trong canh bao "khong cho phep" hoac nhan lich su.

### 6.6 Secret scan

Quet file text, loai `.git`, `node_modules`, ZIP, `.env` va `Secrets.h`, theo cac mau private key, URI MongoDB co credential, AWS/GitHub/OpenAI token va bearer token.

Ket qua: khong phat hien mau credential co do tin cay cao; exit code 0. Khong co secret nao duoc in vao bao cao.

### 6.7 Firmware build

Trang thai: chua chay. `arduino-cli` khong ton tai tren may, vi vay khong tuyen bo compile thanh cong.

Lenh de xuat tren may da cai ESP32 core va thu vien:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 02_ESP32_Main_Firmware/Hydroponic_Device001
```

Can doi FQBN neu Arduino IDE dang dung board profile DevKitC V4 khac, va cai `OneWire`, `DallasTemperature`, `PubSubClient`, `ArduinoJson` theo firmware hien tai.

## 7. Kiem tra khong the/chua duoc chay

| Kiem tra | Ly do |
|---|---|
| ESP32 compile | Thieu `arduino-cli`. |
| Upload firmware/Serial Monitor | Khong co thao tac phan cung trong nhiem vu audit fix. |
| MongoDB transaction tren Atlas/replica set | Cam ket noi database van hanh; fake transaction da test. |
| MongoDB standalone fallback runtime | Chua dung instance staging rieng; failure injection fake DB da test. |
| MQTT Pump A -> Pump B runtime | Cam publish MQTT va dieu khien bom. |
| Dashboard browser runtime | Khong khoi dong backend/service. |
| Migration tren du lieu sao chep | Chua co staging dump da khu danh tinh va khong duoc phep ket noi live DB. |

## 8. Trang thai cac thanh phan

| Thanh phan | Trang thai Fix1 |
|---|---|
| Firmware | Ma nguon Phase 21 duoc bao ton; chua compile trong dot nay. |
| Backend | Syntax pass va 62/62 test pass; runtime that chua kiem chung. |
| Dashboard | Contract test pass; browser/service runtime chua kiem chung. |
| Database schema/index | Ma khoi tao index va lifecycle da sua; chua ap dung len database that. |
| Migration | Pure classification/dry-run test pass; chua chay tren du lieu that. |
| MQTT | Khong ket noi va khong publish. |
| Auto Dosing | Van OFF; khong thay doi runtime state. |
| Calibration set | Khong activate/retire set that. |
| Phan cung/bom | Khong dieu khien; khong co ket qua runtime moi. |

## 9. Loi, rui ro, gioi han va phan chua kiem chung

1. Transaction chi hoat dong tren MongoDB deployment co ho tro session transaction; can test ca replica set va standalone staging.
2. MQTT publish khong the nam trong MongoDB transaction. State `publishing` ngan duplicate, nhung can xac minh quy trinh recovery neu process crash dung giua claim va publish.
3. Unique partial index co the tao that bai neu database hien tai da co du lieu active trung. Can audit/backup data truoc khi deploy index.
4. `measurementAt` la gio backend nhan payload, khong phai timestamp ADC tuyet doi tren ESP32; no giai quyet replay/stale trong workflow hien tai nhung khong thay the sequence number ky so.
5. Firmware ring buffer va DS18B20 nonblocking chua duoc compile trong moi truong nay.
6. Dashboard runtime va responsive layout chua duoc xem bang trinh duyet trong Fix1.
7. Archive `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip` va `_phase21_review/` la bang chung truoc Fix1; can tao lai archive neu gui re-audit ma nguon Fix1.
8. Working tree dang dirty va gom thay doi tu nhieu phase. Bao cao nay khong dong nghia da commit hoac release.
9. Phase 20D DOCX khong co trong repository; cac muc can cap nhat tiep tuc duoc ghi trong status report, DOCX khong bi sua.

## 10. Cong viec tiep theo theo uu tien

1. Review doc lap diff Fix1 va bao cao nay; tao archive ma nguon Fix1 moi, loai secret/build/cache.
2. Cai `arduino-cli`, dung dung FQBN va thu vien de compile firmware; sua moi loi compile truoc upload.
3. Tao MongoDB staging rieng/ban sao da khu danh tinh; kiem tra index conflict, transaction path va standalone fallback.
4. Chay migration dry-run tren staging, luu summary; khong dung `--apply` cho den khi operator review va backup.
5. Khoi dong backend + broker staging, giu Auto Dosing OFF; kiem tra sensor quality/stability va dashboard diagnostics.
6. Thu clean-water voi nutrient bottles disconnect: Pump A -> Pump B -> mixing wait -> chi chap nhan payload moi/cung set.
7. Thu duplicate/out-of-order MQTT status va restart tai state `publishing` de xac nhan recovery policy.
8. Chi sau khi moi interlock pass moi xem xet xac nhan target cho `cai_ngot`; khong enable tren he thong nutrient that trong dot nay.

## 11. Bang chung file/dong cho thay doi an toan

Line number la tai working tree luc tao bao cao:

- `src/config/tdsQualityConfig.js:11-12`: hang so 30 mau va spread raw 50.
- `src/validators/sensorPayloadValidator.js:36,44-47`: count range va stable relationship chinh xac.
- `src/services/tdsQualityService.js:27-30,77-78`: backend tai kiem tra cua so va loc history.
- `src/services/sensorLogService.js:41-44,78`: `measurementAt` phia server.
- `src/services/autoDosingService.js:347-369`: timestamp/set/range gate sau mixing.
- `src/services/autoDosingService.js:539-551`: finalize mixing nguyen tu va go active lock.
- `src/services/autoDosingService.js:805,814`: active run lock va calibration set tai luc bat dau.
- `src/services/autoDosingService.js:924-956`: claim Pump B nguyen tu truoc publish.
- `src/mongoClient.js:81-98`: unique partial lock cho calibration set va dosing run.
- `src/services/tdsCalibrationService.js:308-330`: checked writes va transaction/fallback selector.
- `src/services/tdsCalibrationService.js:360-467`: activate, disable dosing, transaction va rollback.
- `src/services/tdsCalibrationService.js:488-594`: retire, clear pointer, disable dosing va rollback.
- `scripts/migrateLegacyTdsCalibrations.js:26-67`: scan tat ca row, phan loai incomplete va `--apply` explicit.
- `test/phase21FixBehavior.test.js:111-427`: post-mixing, concurrency, Pump B va lifecycle failure injection.
- `test/stabilityMigration.test.js:49-150`: dry-run zero-write va legacy classification.
- `test/tdsCalibration.test.js:142-190`: stable/count/spread boundary contract.

## 12. Xac nhan khong chua secret

- Khong them `.env`, `Secrets.h`, credential, token, private key hoac MongoDB URI that vao source/report.
- `.env.example` chi chua ten bien va gia tri mau khong bi mat.
- Secret scan khong phat hien mau credential co do tin cay cao.
- Bao cao khong chep noi dung URI/secret tu moi truong nguoi dung.

## 13. Xac nhan an toan bat buoc

- Auto Dosing remains OFF.
- No pump command was sent.
- No live calibration set was activated.
- No production database was modified.

Xac nhan bo sung:

- Khong service nao duoc khoi dong.
- Khong MQTT connection nao duoc mo.
- Khong migration `--apply` nao duoc chay.
- Khong co tuyen bo firmware compile thanh cong.
- Khong co thay doi sensor GPIO/pump GPIO chinh thuc trong Fix Round 1.
- Khong co pH dosing, Adaptive Dosing, Zalo Bot, AI Camera hoac authentication moi.
