# PHASE 21 FIX ROUND 1 — RE-AUDIT VÀ KẾ HOẠCH DỌN TÀI LIỆU

Ngày kiểm tra: 2026-08-09  
Nguồn kiểm tra: `Hydroponic_IoT_ESP32(3).rar` và tài liệu Phase 20D cập nhật do người dùng cung cấp.

## 1. Kết luận ngắn

Mã Fix Round 1 có thật trong source và đã sửa các lỗi P0/P1 chính của vòng audit trước: hợp đồng cửa sổ 30 mẫu, measurement sau thời gian trộn, chống tạo run trùng, chống publish Pump B trùng, transaction/fallback lifecycle và migration phân loại `null`/rỗng/thiếu EC-scale-nhiệt độ.

Kiểm tra độc lập trong môi trường cô lập:

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | PASS — 62/62 test |
| `node --check` | PASS — 34/34 file JavaScript |
| Parse `package.json` và `04_Database/sample_payload.json` | PASS |
| `git diff --check` | PASS |
| Firmware ESP32 compile | CHƯA CHẠY — không có `arduino-cli` |
| MongoDB/MQTT/dashboard/phần cứng runtime | CHƯA KIỂM CHỨNG |

Không khởi động service, không kết nối MongoDB/MQTT vận hành, không activate calibration set, không bật Auto Dosing và không gửi lệnh bơm trong vòng audit này.

## 2. Những file hiện không còn là nguồn trạng thái hiện tại

### 2.1 Có thể xoá khỏi cây làm việc hiện tại

| File/thư mục | Lý do |
| --- | --- |
| `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip` | Đây là archive trước Fix 1, SHA-256 `AACEDF568EA1F84EB7B327ABFF87101EB67A16A6FF18110D5141445EE1267235`; không chứa `phase21FixBehavior.test.js`, `testSupport/fakeMongo.js` hoặc báo cáo Fix 1. |
| `_phase21_review/` | Log cũ chỉ phản ánh 37 test và 32 syntax check trước Fix 1. Không được dùng làm bằng chứng cho bản hiện tại. |
| `CODEX_PHASE21_FINAL_REPORT.md` | Báo cáo trước Fix 1; còn ghi 37/37 test, 32/32 syntax check và “chưa có transaction path”. Chính `CODEX_PHASE21_FIX1_FINAL_REPORT.md` đã xác nhận file này chỉ có giá trị lịch sử. |
| `00_Docs/PHASE_20B_20C_REPORT_INSERT.md` | Nội dung trung gian đã được nhập vào DOCX Phase 20D cập nhật. Đã đối chiếu thấy các mục Nutrient Response Test, Auto Dosing V2, kết quả Phase 20C và số liệu 302.27 → 348.88 ppm xuất hiện trong DOCX. |

Việc xoá các mục này phải được ghi trong `00_Docs/PROJECT_STATUS_REPORT.md`. Không xoá bằng wildcard; dùng đúng danh sách đường dẫn trên.

### 2.2 Nên chuyển sang khu vực lưu trữ lịch sử, không dùng làm hướng dẫn hiện tại

| File | Hành động đề xuất | Lý do |
| --- | --- | --- |
| `00_Docs/PHASE_20B_REVIEW_PACKAGE.md` | Chuyển vào `00_Docs/archive/phase20/` và thêm banner “HISTORICAL SNAPSHOT — DO NOT USE FOR CURRENT SAFETY LOGIC”. | File còn ghi nhiều mục `NOT TESTED` và logic cũ `tdsStable === false`; dùng trực tiếp sẽ làm sai fail-closed Phase 21. |
| `00_Docs/PHASE_20C_REVIEW_PACKAGE.md` | Chuyển vào `00_Docs/archive/phase20/` và thêm banner lịch sử. | Trạng thái `NOT TESTED` đã được Phase 20D thay thế bằng kết quả runtime PASS. |
| `00_Docs/PHASE_20D_REVIEW_PACKAGE.md` | Chuyển cùng thư mục archive nhưng giữ lại. | Đây là bằng chứng lịch sử quan trọng cho runtime Phase 20B/20C; không phải bằng chứng runtime Phase 21. |

### 2.3 Xoá có điều kiện sau khi đưa DOCX chính vào vị trí chuẩn

| File | Điều kiện |
| --- | --- |
| `00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md` | Có thể xoá sau khi bản DOCX Phase 20D cập nhật được đặt trong thư mục tài liệu chính, kiểm tra mở được và `PROJECT_STATUS_REPORT.md` ghi rõ tên/hash của bản chuẩn. Hiện file này vẫn hữu ích vì DOCX chưa nằm trong repository. |

## 3. Những file phải giữ và xem là nguồn hiện hành

- `CODEX_PHASE21_FIX1_FINAL_REPORT.md`: báo cáo bàn giao hiện tại của vòng Fix 1, cho đến khi có báo cáo mới thay thế.
- `00_Docs/PROJECT_STATUS_REPORT.md`: trạng thái tích lũy; cần cập nhật lại sau dọn file.
- `README.md` và `03_Edge_Server/mqtt_backend/README.md`: hướng dẫn vận hành hiện tại; backend README cần sửa mâu thuẫn nêu ở mục 5.
- `00_Docs/EC_TDS_Calibration.md`: hướng dẫn calibration EC-first hiện tại.
- `00_Docs/Database_Schema.md`, `00_Docs/Payload_Format.md`, `04_Database/mongodb_schema.md`, `04_Database/sample_payload.json`: contract dữ liệu hiện tại.
- `00_Docs/Pin_Map.md`, `00_Docs/Wiring_Checklist.md`, `00_Docs/Pump_Calibration.md`: tài liệu phần cứng vẫn cần giữ.
- Tài liệu Phase 20D cập nhật: dùng đối chiếu kiến trúc/nội dung đồ án, nhưng code mới nhất vẫn ưu tiên khi có khác biệt.

## 4. Những thông tin cũ không được sử dụng nữa

| Thông tin cũ | Thông tin mới thay thế |
| --- | --- |
| Lấy 10 điểm calibration mới nhất | Chỉ dùng các point thuộc explicit active calibration set. |
| Calibration ppm-first hoặc dùng `calibrationFactor` | EC-first: `voltage25 → EC µS/cm → TDS scale 500`, factor cố định `0.5`. |
| Một hoặc hai điểm có thể dùng để control | Tối thiểu ba điểm EC khác nhau, đơn điệu theo voltage25 và EC. |
| Ngoại suy ngoài miền calibration | Ngoài miền trả `ecUsCm=null`, `tdsPpm=null`; control invalid. |
| Thiếu/sai nhiệt độ vẫn có fallback | Thiếu/sai nhiệt độ làm measurement và control invalid. |
| Chỉ chặn khi `tdsStable === false`; thiếu cờ vẫn cho chạy | Fail-closed: stability và toàn bộ quality/calibration gate phải rõ ràng `true`. |
| `tdsWindowStable=true` có thể đi cùng 0/29 mẫu | Phải đúng 30 mẫu và `tdsSpreadRaw <= 50`; validator backend tự tính lại quan hệ. |
| Measurement có trước khi hết mixing vẫn hoàn tất run | Phải có `measurementAt > mixingUntil`, đúng calibration set ban đầu và còn active/valid. |
| Phase 20B/20C `NOT TESTED` | Runtime prototype Phase 20B/20C đã PASS theo Phase 20D; kết quả này không thay thế kiểm thử runtime Phase 21. |
| Phase 21 có 37 test/32 syntax checks | Fix 1 hiện có 62 test/34 syntax checks. |
| Calibration lifecycle chỉ có rollback, chưa có transaction | Fix 1 đã có transaction path khi MongoDB hỗ trợ và checked fallback rollback khi không hỗ trợ; runtime topology thật vẫn chưa kiểm chứng. |

Các thông tin sau vẫn còn hiệu lực, không được xoá hoặc đổi thành “đã hoàn thành”:

- Auto Dosing mặc định và runtime phải tiếp tục `OFF`.
- Firmware Phase 21 chưa compile/upload.
- MongoDB transaction, dashboard browser, MQTT và phần cứng Phase 21 chưa kiểm chứng runtime.
- Chưa có active live calibration set.
- Hai gói Hanna cùng 1413 µS/cm chỉ tạo một mức EC riêng biệt; chưa đủ ba điểm.
- Các ngưỡng 30 mẫu, spread 50 raw, ba payload/120 giây, 20 ppm hoặc 3% là ngưỡng phần mềm ban đầu, cần xác nhận thực nghiệm.

## 5. Phát hiện còn lại sau re-audit Fix 1

### P1 — Backend README vẫn còn một quy tắc stability cũ

`03_Edge_Server/mqtt_backend/README.md:434` còn ghi:

```text
If tdsStable exists and is false, dosing is skipped.
```

Câu này mâu thuẫn với code fail-closed hiện tại. Phải sửa thành: Auto Dosing chỉ được phép khi `tdsStable === true`, `tdsControlValid === true`, cửa sổ firmware đủ 30 mẫu, nằm trong miền active set, nhiệt độ hợp lệ và các interlock khác đều đạt. Khối default settings ở cùng phần cũng thiếu `cropCode:"cai_ngot"` và `targetRangeConfirmed:false`.

### P2 — Migration còn gọi quá rộng một số row là `completeModernRows`

`scripts/migrateLegacyTdsCalibrations.js:getLegacyReasons()` hiện chỉ kiểm tra:

- `calibrationSetId`;
- `referenceEcUsCm`;
- `referenceScale`;
- `waterTemp`.

Một row có bốn trường trên nhưng thiếu/sai `tdsFactor`, `referenceTdsPpm`, `method`, `measuredVoltage25`, `temperatureCompensated`, `temperatureFactorUsed` hoặc `deviceId` vẫn có thể bị đếm là `completeModernRows`, dù validator activation sẽ từ chối nó. Đây chưa phải đường auto-activate, nhưng làm báo cáo migration audit thiếu chính xác. Cần dùng chung một helper “modern point completeness” với validator hoặc mở rộng đầy đủ lý do; thêm test cho từng metadata bắt buộc. Migration vẫn phải dry-run mặc định và không tự suy diễn/ghi giá trị calibration.

### P2 — Ba payload stability chưa có định danh chống lặp

Backend đang đếm ba row phù hợp trong 120 giây. Contract hiện không có `measurementId`/sequence riêng để loại ba bản tin trùng hoàn toàn. Đây là đề xuất hardening, không phải lỗi so với yêu cầu Phase 21 hiện tại. Trước khi thêm field mới, cần quyết định có dùng cặp `uptimeMs + measurementAt` hoặc sequence number hay không và kiểm thử tương thích firmware/dashboard.

### Trạng thái cần giữ

- Source Fix 1 vẫn nằm trong working tree chưa commit; cần tạo checkpoint Git sau khi người dùng cho phép.
- Firmware compile và staging vẫn là blocker trước khi thử Auto Dosing.
- RAR người dùng gửi chứa `.git`, `node_modules`, `.env` và `Secrets.h`; không dùng RAR này để chia sẻ. `.env` và `Secrets.h` không được đọc hoặc đưa vào báo cáo.

## 6. Prompt đề xuất gửi Codex — Cleanup + Fix Round 2

```text
PHASE 21 FIX ROUND 2 — DOCUMENT CONSOLIDATION, MIGRATION AUDIT HARDENING
AND SAFE REVIEW PACKAGE

Mục tiêu:
1. Loại tài liệu/artifact đã bị Fix Round 1 thay thế.
2. Sửa mâu thuẫn tài liệu còn lại.
3. Làm migration audit nhận diện đầy đủ mọi calibration point không đạt contract hiện đại.
4. Tạo một báo cáo bàn giao tổng hợp duy nhất và một ZIP review đã loại secret.

RÀNG BUỘC AN TOÀN
- Không khởi động backend/service.
- Không kết nối MongoDB hoặc MQTT vận hành.
- Không chạy migration với database thật, kể cả apply.
- Không publish MQTT, không điều khiển bơm.
- Không activate/retire calibration set thật.
- Không bật Auto Dosing; mặc định và trạng thái phải tiếp tục OFF.
- Không thay GPIO, pump sequence A → B → mixing wait hoặc protocol hiện có.
- Không đọc/in `.env`, `Secrets.h`, credential, token hoặc URI bí mật.
- Mọi file sửa/tạo/xoá/chuyển phải ghi vào `00_Docs/PROJECT_STATUS_REPORT.md`.

A. DỌN FILE ĐÃ BỊ THAY THẾ
Xoá đúng các mục sau; không dùng wildcard:
- `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip`
- `_phase21_review/`
- `CODEX_PHASE21_FINAL_REPORT.md`
- `00_Docs/PHASE_20B_20C_REPORT_INSERT.md`

Chuyển các snapshot sau vào `00_Docs/archive/phase20/`:
- `00_Docs/PHASE_20B_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20C_REVIEW_PACKAGE.md`
- `00_Docs/PHASE_20D_REVIEW_PACKAGE.md`

Thêm banner đầu mỗi snapshot:
`HISTORICAL SNAPSHOT — DO NOT USE FOR CURRENT PHASE 21 SAFETY LOGIC.`
Ghi rõ Phase 20B/20C `NOT TESTED` là trạng thái tại thời điểm tạo snapshot;
trạng thái runtime lịch sử mới hơn nằm trong Phase 20D/PROJECT_STATUS_REPORT.

Chưa xoá `00_Docs/MAIN_REPORT_PHASE20D_DOCX_UPDATE_REVIEW.md` trong vòng này,
trừ khi bản DOCX Phase 20D chuẩn đã được người dùng đặt vào repository và Codex
đã kiểm tra/hash/ghi nhận nó trong status report.

B. SỬA TÀI LIỆU HIỆN HÀNH
- Sửa `03_Edge_Server/mqtt_backend/README.md` để loại câu logic cũ
  `If tdsStable exists and is false...`.
- Ghi fail-closed chính xác: chỉ cho dosing khi `tdsStable === true`,
  `tdsControlValid === true` và mọi calibration/temperature/water/pump/freshness
  gate đều đạt.
- Cập nhật default settings có `cropCode:"cai_ngot"` và
  `targetRangeConfirmed:false`.
- Tìm toàn bộ active docs để loại/mang nhãn lịch sử cho các cụm:
  latest 10 points, ppm-first, one/two point control, extrapolation,
  optional tdsStable, 37 tests, 32 syntax checks, no transaction path.
- Không xoá số liệu runtime Phase 20B/20C; phải ghi rõ đó là bằng chứng lịch sử,
  không phải runtime validation Phase 21.

C. HARDEN MIGRATION AUDIT
- Refactor `getLegacyReasons()` hoặc tạo helper dùng chung để một row chỉ được gọi
  `completeModernRows` khi đủ và hợp lệ tất cả metadata activation cần dùng:
  deviceId, calibrationSetId, referenceEcUsCm, referenceScale="500",
  tdsFactor=0.5, referenceTdsPpm=referenceEcUsCm*0.5 trong tolerance,
  valid waterTemp, measuredVoltage, measuredVoltage25,
  temperatureCompensated=true, valid temperatureFactorUsed,
  method="piecewise_linear_ec", và các trường quan hệ bắt buộc khác trong validator.
- Không tự điền, suy diễn hoặc sửa giá trị calibration.
- Dry-run phải zero-write; apply chỉ được mark `legacy`, `legacyReasons`, audit time.
- Thêm test cho từng trường thiếu/sai, row null/rỗng, row có set ID nhưng thiếu
  metadata, complete modern row, dry-run zero-write và apply không activate.

D. KIỂM TRA
Chạy cô lập, không dùng DB/MQTT thật:
- `npm test`
- `node --check` cho toàn bộ JS backend/dashboard/test/migration
- parse JSON sample/package
- `git diff --check`
- source search cho logic/tài liệu cũ
- kiểm tra `arduino-cli`; nếu không có, ghi NOT RUN và lệnh compile đề xuất,
  không tuyên bố compile thành công.

E. PACKAGE VÀ BÁO CÁO DUY NHẤT
- Tạo ZIP mới: `Hydroponic_IoT_ESP32_PHASE21_FIX2_REVIEW.zip`.
- ZIP phải chứa mọi source/test/doc mới, kể cả file untracked cần thiết.
- Loại tuyệt đối: `.git/`, `node_modules/`, `.env`, `Secrets.h`, credential,
  token, DB dump, build/dist/cache, archive review cũ.
- Kiểm kê ZIP và scan tên entry/pattern bí mật trước khi bàn giao.
- Không tạo thư mục nhiều log rời như `_phase21_review/`.
- Tạo đúng một báo cáo tổng hợp:
  `CODEX_PHASE21_FIX2_FINAL_REPORT.md`.
- Báo cáo phải chứa trạng thái từng yêu cầu, mọi file sửa/tạo/xoá/chuyển,
  lệnh và kết quả/exit code, test pass/fail, SHA-256 ZIP, các phần chưa kiểm chứng,
  rủi ro runtime và xác nhận an toàn.

Xác nhận cuối bắt buộc:
Auto Dosing remains OFF.
No pump command was sent.
No live calibration set was activated or retired.
No production database was read or modified.
No MQTT message was published.
Firmware compile status is reported truthfully.
```

## 7. Thứ tự tiếp theo sau Fix Round 2

1. Re-audit ZIP Fix 2.
2. Compile firmware với đúng ESP32 FQBN và thư viện.
3. Dùng MongoDB/MQTT staging riêng, Auto Dosing OFF.
4. Kiểm thử transaction/index/migration dry-run và dashboard browser.
5. Upload firmware, xác nhận payload 30 mẫu và temperature nullable.
6. Kiểm chứng cảm biến/bơm/trộn bằng nước sạch.
7. Đủ ba chuẩn EC khác nhau rồi mới tạo/activate set trong staging.
8. Chỉ cân nhắc thử dosing có giám sát sau khi toàn bộ gate đạt.

