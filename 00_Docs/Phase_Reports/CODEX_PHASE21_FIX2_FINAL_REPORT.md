# CODEX PHASE 21 FIX ROUND 2 - FINAL REPORT

## 1. Phạm vi và mục tiêu

Phase 21 Fix Round 2 thực hiện đúng kế hoạch re-audit ngày 2026-08-09:

- Xóa artifact trước Fix1 đã bị thay thế.
- Chuyển ba snapshot Phase 20 vào khu vực archive và gắn cảnh báo lịch sử.
- Sửa câu stability fail-open còn lại trong backend README.
- Dùng chung một contract completeness giữa calibration activation và migration audit.
- Mở rộng migration reason counts và test từng metadata bắt buộc.
- Tạo một ZIP review lọc secret và một báo cáo bàn giao tổng hợp duy nhất.

Không mở rộng tính năng dosing, không thay GPIO, không thay Pump A -> Pump B ->
`mixing_wait`, không thêm authentication, pH dosing hoặc Adaptive Dosing.

## 2. Trạng thái yêu cầu

| Yêu cầu | Trạng thái | Kết quả |
|---|---|---|
| Xóa bốn artifact cũ bằng đường dẫn chính xác | Hoàn thành | Bốn đường dẫn đã được xác minh không còn tồn tại. |
| Archive ba snapshot Phase 20 | Hoàn thành | Đã chuyển vào `00_Docs/archive/phase20/`, banner lịch sử đạt 3/3. |
| Giữ review note DOCX có điều kiện | Hoàn thành | Đã giữ vì repository chưa có DOCX Phase 20D chuẩn. |
| Sửa README fail-closed | Hoàn thành | Chỉ cho dosing khi `tdsStable === true`, `tdsControlValid === true` và mọi gate đều pass. |
| Thêm crop/default confirmation | Hoàn thành | Có `cropCode:"cai_ngot"`, `targetRangeConfirmed:false`. |
| Harden migration completeness | Hoàn thành | Migration dùng helper chung với activation validator và đếm `reasonCounts`. |
| Dry-run zero-write/apply không suy diễn | Hoàn thành | Test pass; apply chỉ ghi ba trường audit legacy. |
| Dọn câu logic/số kiểm tra cũ trong active docs | Hoàn thành | Contradiction search có 0 match. Nội dung legacy còn lại được gắn nhãn lịch sử/removed. |
| Tạo ZIP review lọc secret | Hoàn thành | Inventory và SHA-256 ghi tại mục 8. |
| Firmware compile | Chưa kiểm chứng | `arduino-cli` không được cài đặt. |
| MongoDB/MQTT/dashboard/phần cứng runtime | Chưa kiểm chứng | Không kết nối hoặc khởi động trong nhiệm vụ này. |
| Measurement ID chống payload lặp | Chưa làm | Đề xuất hardening tương lai, ngoài phạm vi Fix2. |

Phase 21 chưa được tuyên bố hoàn tất vận hành. Fix2 chỉ hoàn tất ở mức source,
tài liệu, test cô lập và packaging.

## 3. File sửa, tạo, xóa và chuyển

### 3.1 File sửa

| File | Mục đích |
|---|---|
| `README.md` | Ghi trạng thái Fix2 và phân biệt runtime Phase 20 với Phase 21. |
| `00_Docs/PROJECT_PLAN.md` | Thêm Phase 21 Fix Round 2. |
| `00_Docs/PROJECT_STATUS_REPORT.md` | Ghi cleanup, file inventory, verification, rủi ro và bước tiếp theo. |
| `03_Edge_Server/mqtt_backend/README.md` | Sửa stability fail-closed, crop defaults và migration completeness. |
| `03_Edge_Server/mqtt_backend/scripts/migrateLegacyTdsCalibrations.js` | Dùng completeness helper chung và thêm `reasonCounts`. |
| `03_Edge_Server/mqtt_backend/src/services/tdsCalibrationService.js` | Activation validation dùng completeness helper chung. |
| `03_Edge_Server/mqtt_backend/src/validators/tdsCalibrationSetValidator.js` | Thêm full persisted-point completeness contract. |
| `03_Edge_Server/mqtt_backend/test/phase21FixBehavior.test.js` | Bổ sung metadata đầy đủ cho fixture activation. |
| `03_Edge_Server/mqtt_backend/test/stabilityMigration.test.js` | Test từng metadata, reason counts, dry-run và apply. |
| `03_Edge_Server/mqtt_backend/test/tdsCalibration.test.js` | Bổ sung metadata đầy đủ cho fixture set validation. |

### 3.2 File tạo

- `00_Docs/archive/phase20/PHASE_20B_REVIEW_PACKAGE.md`
- `00_Docs/archive/phase20/PHASE_20C_REVIEW_PACKAGE.md`
- `00_Docs/archive/phase20/PHASE_20D_REVIEW_PACKAGE.md`
- `CODEX_PHASE21_FIX2_FINAL_REPORT.md`
- `Hydroponic_IoT_ESP32_PHASE21_FIX2_REVIEW.zip`

Ba file archive là snapshot được chuyển từ vị trí cũ và thêm banner, không phải
tài liệu an toàn hiện hành.

### 3.3 File/thư mục xóa

- `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip`
- `_phase21_review/` cùng mười log pre-Fix1 bên trong
- `CODEX_PHASE21_FINAL_REPORT.md`
- `00_Docs/PHASE_20B_20C_REPORT_INSERT.md`

### 3.4 File chuyển

- `00_Docs/PHASE_20B_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20B_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20C_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20C_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20D_REVIEW_PACKAGE.md` -> `00_Docs/archive/phase20/PHASE_20D_REVIEW_PACKAGE.md`

### 3.5 File giữ lại có điều kiện

- `00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md`: chưa xóa vì chưa có DOCX
  Phase 20D chuẩn trong repository để mở, hash và ghi nhận.

## 4. Logic trước và sau

### 4.1 Tài liệu Auto Dosing

Trước Fix2, README nói chỉ skip nếu `tdsStable` tồn tại và false. Cách diễn đạt
này cho phép hiểu nhầm rằng thiếu cờ vẫn được dosing.

Sau Fix2, README yêu cầu rõ:

- `tdsStable === true`.
- `tdsControlValid === true`.
- Cửa sổ firmware đúng 30 mẫu và trong ngưỡng spread.
- Measurement fresh, trong miền active set và temperature hợp lệ.
- Water, pump, calibration, target, run và daily-limit gates đều pass rõ ràng.

### 4.2 Migration audit

Trước Fix2, `completeModernRows` chỉ dựa trên set ID, EC, scale và temperature.
Một row thiếu derived metadata vẫn có thể bị báo là complete.

Sau Fix2, helper `getModernCalibrationPointReasons()` kiểm tra:

- `deviceId` và `calibrationSetId` không rỗng.
- `measuredRaw`, `measuredVoltage` và quan hệ ADC/voltage.
- EC, scale `500`, factor `0.5`, TDS dẫn xuất trong tolerance.
- Water temperature hợp lệ, không nhận giá trị 85 C.
- `measuredVoltage25`, `temperatureCompensated`, temperature factor và quan hệ dẫn xuất.
- Reference 25 C, alpha 0.02/C và method `piecewise_linear_ec`.
- Không mang legacy marker.

Activation set và migration audit cùng gọi helper này. Migration chỉ phân loại;
không tự điền, sửa calibration, đổi lifecycle hay activate set.

### 4.3 Tài liệu lịch sử

Các snapshot Phase 20 vẫn giữ số liệu runtime lịch sử nhưng banner đầu file cấm
dùng logic cũ cho Phase 21. Các dòng `NOT TESTED` trong snapshot chỉ là trạng thái
tại thời điểm tạo; trạng thái mới hơn xem ở Phase 20D và project status.

## 5. Quyết định kỹ thuật

1. Đặt completeness helper trong calibration validator để migration và activation
   không duy trì hai định nghĩa “modern point” khác nhau.
2. Kiểm tra cả giá trị vật lý lẫn quan hệ dẫn xuất để phát hiện metadata tồn tại
   nhưng sai.
3. Giữ `reasonCounts` động theo reason code, đồng thời giữ các counter cũ để không
   làm mất khả năng đọc báo cáo migration hiện có.
4. Không thêm `measurementId` trong Fix2 vì cần quyết định protocol firmware và
   compatibility dashboard trước; rủi ro được ghi công khai.
5. Không xóa review note DOCX khi điều kiện chưa đạt.
6. Không dùng migration thật để kiểm thử; fake rows đủ để chứng minh zero-write và
   apply field restrictions mà không chạm dữ liệu vận hành.

## 6. Test và kiểm tra

### 6.1 Full test suite

Thư mục:

```text
03_Edge_Server/mqtt_backend
```

Lệnh:

```powershell
npm test
```

Kết quả:

```text
script: node --test
tests: 84
pass: 84
fail: 0
cancelled: 0
skipped: 0
todo: 0
duration_ms: 408.3719
exit code: 0
```

### 6.2 JavaScript syntax

Lệnh:

```powershell
$files = Get-ChildItem -Path src,public,scripts,test,testSupport -Recurse -File -Filter *.js
foreach ($file in $files) { node --check $file.FullName }
```

Kết quả:

```text
NODE_CHECK_TOTAL=34
NODE_CHECK_FAILED=0
exit code: 0
```

### 6.3 JSON parse

Lệnh:

```powershell
Get-Content 03_Edge_Server/mqtt_backend/package.json -Raw | ConvertFrom-Json
Get-Content 04_Database/sample_payload.json -Raw | ConvertFrom-Json
```

Kết quả:

```text
package.json: PASS
04_Database/sample_payload.json: PASS
JSON_PARSE_FAILED=0
exit code: 0
```

### 6.4 Migration dry-run test

Lệnh:

```powershell
node --test --test-name-pattern="migration dry-run performs no writes" test/stabilityMigration.test.js
```

Kết quả:

```text
tests: 1
pass: 1
fail: 0
duration_ms: 271.9655
fake database writes: 0
exit code: 0
```

Không chạy script migration với MongoDB thật, kể cả apply.

### 6.5 Git diff check

Lệnh:

```powershell
git diff --check
```

Kết quả: exit code 0, không có whitespace error. Git chỉ cảnh báo LF có thể đổi
sang CRLF trên Windows.

### 6.6 Source/document search

Kết quả:

```text
ACTIVE_DOC_CONTRADICTION_MATCHES=0
ACTIVE_CONTROL_LEGACY_SEARCH_MATCHES=0
exit code: 0
```

Các cụm ppm-first, one/two-point hoặc extrapolation còn trong active README chỉ
nằm trong đoạn gắn nhãn legacy và nói rõ không được dùng.

### 6.7 Cleanup verification

```text
CLEANUP_TARGETS=PASS
ARCHIVE_BANNERS=3/3
DOCX_REVIEW_NOTE=RETAINED
exit code: 0
```

### 6.8 Firmware build

```text
ARDUINO_CLI=NOT_FOUND
compile status: NOT RUN
```

Lệnh compile đề xuất sau khi cài ESP32 core và thư viện:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 02_ESP32_Main_Firmware/Hydroponic_Device001
```

FQBN phải được đối chiếu với board profile DevKitC V4 thực tế. Không tuyên bố
firmware compile thành công.

## 7. Trạng thái thành phần

| Thành phần | Trạng thái |
|---|---|
| Firmware | Source Phase 21 giữ nguyên trong Fix2; chưa compile/upload. |
| Backend | 84/84 test và 34/34 syntax pass; runtime thật chưa kiểm chứng. |
| Dashboard | Contract tests pass; browser runtime Fix2 chưa chạy. |
| Database | Không đọc/ghi production; index/transaction runtime chưa kiểm chứng. |
| Migration | Fake dry-run zero-write; chưa chạy trên sanitized/live data. |
| MQTT | Không kết nối, subscribe hoặc publish. |
| Calibration lifecycle | Không activate/retire live set. |
| Auto Dosing | Vẫn OFF; không đổi runtime state. |
| Pumps/hardware | Không điều khiển; không có runtime result mới. |

## 8. Review ZIP và secret safety

Tên archive:

```text
Hydroponic_IoT_ESP32_PHASE21_FIX2_REVIEW.zip
```

SHA-256:

```text
EBE94FC677542B2C166BC65C0A841DEB726502FB0A88B300E0C4260406A7C8B9
```

Inventory cuối:

```text
entry count: 85
secret/high-confidence token matches: 0
forbidden exact entries: 0
```

Loại khỏi ZIP:

- `.git/`
- `node_modules/`
- exact `.env`
- exact `Secrets.h`
- ZIP/RAR/7z cũ
- credential/token file, database dump
- build/dist/cache/log output

`Secrets.h.example` và `.env.example` được giữ vì chỉ là template không chứa
credential vận hành.

Lưu ý tự tham chiếu: bản báo cáo nằm trong ZIP chứa marker SHA ở trên. Sau khi
ZIP được đóng, bản báo cáo authoritative nằm cạnh ZIP được cập nhật bằng SHA-256
thật. Không thể nhúng hash cuối của một archive vào chính file bên trong archive
mà không làm thay đổi hash đó.

## 9. Rủi ro, giới hạn và phần chưa kiểm chứng

1. Firmware chưa compile hoặc upload.
2. MongoDB transaction, unique partial index và fallback chưa thử trên topology staging thật.
3. Migration chưa chạy trên bản sao dữ liệu đã khử danh tính.
4. Dashboard chưa được kiểm tra trực quan trong browser cho Fix2.
5. MQTT duplicate/out-of-order runtime chưa thử với broker staging.
6. Stability ba payload chưa có `measurementId`/sequence chống bản tin lặp hoàn toàn.
7. Các threshold 30 mẫu, spread 50 raw, ba payload/120 giây và 20 ppm/3% cần
   xác nhận từ dữ liệu cảm biến thật.
8. Chưa có active live calibration set; hai gói Hanna 1413 uS/cm vẫn chỉ là một
   mức EC và không đủ ba điểm distinct.
9. Working tree chưa commit và chứa thay đổi tích lũy nhiều phase.
10. Phase 20D DOCX chuẩn chưa nằm trong repository.

## 10. Việc tiếp theo theo ưu tiên

1. Re-audit ZIP Fix2 và kiểm tra SHA-256.
2. Tạo checkpoint Git sau khi người dùng review/cho phép.
3. Cài `arduino-cli`, xác nhận FQBN/thư viện và compile firmware.
4. Dùng MongoDB/MQTT staging riêng, Auto Dosing OFF.
5. Audit index conflict và chạy migration dry-run trên bản sao dữ liệu đã khử danh tính.
6. Kiểm thử transaction/fallback, dashboard browser và payload 30 mẫu.
7. Thử clean-water sequence có giám sát.
8. Chỉ tạo active set staging sau khi có ba chuẩn EC distinct hợp lệ.
9. Quyết định protocol `measurementId`/sequence trước hardening stability tiếp theo.

## 11. Bằng chứng file/dòng an toàn

Line number tại thời điểm tạo báo cáo:

- `src/validators/tdsCalibrationSetValidator.js:31-105`: full modern-point completeness helper.
- `src/validators/tdsCalibrationSetValidator.js:232`: export helper dùng chung.
- `src/services/tdsCalibrationService.js:13,72-77`: activation dùng completeness helper.
- `scripts/migrateLegacyTdsCalibrations.js:5-9`: migration dùng cùng helper.
- `scripts/migrateLegacyTdsCalibrations.js:27,31-34`: `reasonCounts` theo từng reason.
- `test/stabilityMigration.test.js:104-163`: từng metadata, complete row và summary counts.
- `test/stabilityMigration.test.js:165-192`: apply chỉ mark legacy audit fields.
- `03_Edge_Server/mqtt_backend/README.md:438-442`: dosing fail-closed rõ ràng.
- `03_Edge_Server/mqtt_backend/README.md:463-464`: crop và target confirmation mặc định.
- `00_Docs/archive/phase20/*.md:1`: banner lịch sử bắt buộc.
- `00_Docs/PROJECT_STATUS_REPORT.md:310-326`: verification Fix2 và runtime chưa kiểm chứng.

## 12. Xác nhận secret

- Không đọc hoặc in nội dung `.env`, `Secrets.h`, credential, token hay URI bí mật.
- Content secret scan: `HIGH_CONFIDENCE_MATCH_FILES=0`.
- ZIP inventory scan loại exact `.env`, exact `Secrets.h`, `.git` và `node_modules`.
- Không có database dump hoặc build/cache output trong archive.

## 13. Xác nhận an toàn bắt buộc

Auto Dosing remains OFF.

No pump command was sent.

No live calibration set was activated or retired.

No production database was read or modified.

No MQTT message was published.

Firmware compile status is reported truthfully: NOT RUN because `arduino-cli` was not found.

Xác nhận bổ sung:

- Không backend/service nào được khởi động.
- Không migration operational hoặc `--apply` nào được chạy.
- Không thay GPIO, sensor behavior hay pump sequence.
- Không xóa file bằng wildcard.
