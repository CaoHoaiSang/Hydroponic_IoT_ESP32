# BÁO CÁO AUDIT ĐỘC LẬP PHASE 21

## 1. Kết luận

Phase 21 **chưa đạt điều kiện hoàn thành để chuyển sang runtime hoặc thử Auto Dosing**.

Phần lớn kiến trúc EC-first đã được triển khai thật trong mã nguồn: calibration set
`draft -> active -> retired`, nội suy `voltage25 -> EC -> TDS scale 500`, không ngoại
suy cho điều khiển, firmware lấy median 30 mẫu không chặn, quality contract, readiness
và các gate Auto Dosing fail-closed cơ bản đều có mặt.

Tuy nhiên audit độc lập phát hiện:

- 1 lỗi fail-closed trực tiếp ở hợp đồng `tdsWindowStable`.
- 3 nhóm rủi ro an toàn cần sửa trước runtime: hậu-mixing, race/idempotency bơm và
  atomicity lifecycle.
- Migration legacy chưa nhận diện đủ dữ liệu cần audit.
- Bộ test 37 PASS nhưng một số test bắt buộc chỉ kiểm tra helper hoặc tìm chuỗi source,
  chưa kiểm tra hành vi service/lifecycle/pump thực tế.
- README backend vẫn chứa hướng dẫn TDS cũ mâu thuẫn trực tiếp với Phase 21.

Vì vậy trạng thái đúng là: **source đã triển khai một phần lớn và kiểm tra tĩnh PASS,
nhưng Phase 21 cần một vòng sửa lỗi trước khi compile/upload firmware hoặc thử nghiệm
database/MQTT/phần cứng.**

## 2. Phạm vi audit và các thao tác an toàn

- Nguồn audit chính: `Hydroponic_IoT_ESP32_PHASE21_REVIEW.zip` nằm trong file RAR
  người dùng cung cấp.
- SHA-256 ZIP đã xác minh:
  `AACEDF568EA1F84EB7B327ABFF87101EB67A16A6FF18110D5141445EE1267235`.
- ZIP có 122 entry, trong đó 93 file; không có `.git/`, exact `.env`, `Secrets.h` hoặc
  `node_modules/`.
- Không khởi động backend/dashboard service.
- Không kết nối MongoDB hoặc MQTT.
- Không chạy migration operational.
- Không activate/retire calibration set.
- Không bật Auto Dosing.
- Không publish lệnh bơm.
- Không sửa mã nguồn dự án trong vòng audit.

Lưu ý đóng gói: file RAR bao ngoài có 3.569 entry và chứa `.git/`, `.env`, `Secrets.h`.
Không nên gửi RAR này cho người khác. Chỉ nên chia sẻ ZIP Phase 21 đã xác minh ở trên.
Audit không đọc hoặc công bố nội dung các file bí mật đó.

## 3. Kết quả kiểm tra độc lập

| Kiểm tra | Kết quả độc lập |
|---|---|
| SHA-256 ZIP | Khớp báo cáo Codex |
| Inventory ZIP | 122 entry / 93 file |
| `npm ci` | PASS; cài 132 package trong thư mục audit cô lập |
| `npm test` | PASS: 37 pass, 0 fail, 0 skipped |
| `node --check` | PASS: 32/32 file JavaScript |
| `git diff --check` trên working tree RAR | Exit code 0 |
| Firmware compile | Chưa chạy; không có bằng chứng compile |
| Migration operational dry-run | Chưa chạy; chỉ test fake DB zero-write |
| Runtime dashboard/backend | Chưa kiểm chứng |
| MongoDB/MQTT/phần cứng | Không kết nối/không thao tác |

## 4. Phần đã triển khai đúng hoặc cơ bản đúng

1. Hằng số EC/TDS được tách tại
   `src/config/tdsQualityConfig.js`: scale `500`, factor `0.5`, reference `25 C`, alpha
   `0.02/C`, ADC `4095`, reference voltage `3.3 V`, trần sensor `2.3 V`, tolerance
   `0.02 V`, tối thiểu 3 điểm.
2. Điểm hiệu chuẩn mới yêu cầu EC tham chiếu, nhiệt độ hợp lệ, ADC/voltage khớp và
   tự suy ra `referenceTdsPpm = referenceEcUsCm * 0.5`.
3. `applyTdsCalibration()` chọn set bằng `devices.activeTdsCalibrationSetId`, chỉ đọc
   điểm đúng `deviceId + calibrationSetId`, revalidate các điểm và không dùng latest-10.
4. Ngoài miền voltage của set active, `ecUsCm` và `tdsPpm` giữ `null` cùng warning
   below/above range.
5. Firmware giữ GPIO34, ADC 12-bit, `ADC_11db`, công thức `raw * 3.3 / 4095`, dùng
   ring buffer 30 mẫu/40 ms và median; không có `delay(40)`.
6. DS18B20 dùng conversion không chặn; disconnected, 85 C và ngoài 0-50 C bị loại;
   payload phát `waterTemp:null` khi invalid.
7. `sensor_logs` và `devices.latest` có các trường quality chính, gồm `tdsMin`,
   `tdsMax`, EC, TDS, set identity, temperature metadata, stability và control reasons.
8. Auto Dosing mặc định OFF; readiness dùng so sánh explicit `=== true`/`!== true`,
   target cải ngọt cần xác nhận và phải nằm trong miền set active.
9. Flow danh nghĩa Pump A -> Pump B -> mixing wait vẫn được giữ trong source.
10. Dashboard có quản lý draft/active/retired, EC input, diagnostics, confirmation
    activate/retire và edit guard.

## 5. Phát hiện cần sửa

### P0 — Backend chấp nhận `tdsWindowStable=true` dù chưa có mẫu

`src/validators/sensorPayloadValidator.js:34-38` chỉ kiểm tra:

- `tdsSampleCount` nằm trong 0-30.
- `tdsSpreadRaw` là số không âm và bằng `tdsMax - tdsMin`.
- `tdsWindowStable` là boolean.

Validator không buộc công thức:

```text
tdsWindowStable === (tdsSampleCount === 30 && tdsSpreadRaw <= 50)
```

`src/services/tdsQualityService.js:23-28` sau đó tin trực tiếp cờ này và không kiểm tra
sample count/spread. Kiểm tra đối kháng độc lập đã chứng minh payload có
`tdsSampleCount=0`, `tdsSpreadRaw=0`, `tdsWindowStable=true` được validator chấp nhận;
ba payload như vậy tạo `tdsStable=true`.

Đây là lỗi fail-closed trực tiếp vì dữ liệu firmware lỗi hoặc payload giả có thể vượt
qua stability gate và làm `tdsControlValid=true` khi calibration/interlock khác hợp lệ.

Yêu cầu sửa:

- Thêm named constants backend cho 30 mẫu và 50 ADC count.
- Validator phải kiểm tra quan hệ chính xác giữa count, spread và stable.
- `calculateTdsStability()` nên tự kiểm tra lại `tdsSampleCount===30` và
  `tdsSpreadRaw<=50`, không chỉ tin cờ.
- Thêm test cho count 0/29, spread 51 và mọi tổ hợp cờ không khớp.

### P1 — Hậu-mixing chưa chứng minh measurement được tạo sau khi mixing kết thúc

`getMixingMeasurementInvalidReasons()` tại
`src/services/autoDosingService.js:331-343` chỉ kiểm tra freshness 120 giây. Nó không
nhận `mixingUntil` và không yêu cầu `device.lastSeenAt > run.mixingUntil`.

`evaluateAutoDosing()` tại `575-620` vì vậy có thể hoàn tất run bằng measurement được
lưu trước thời điểm mixing kết thúc nếu callback bị trì hoãn hoặc có xử lý MQTT bất
đồng bộ chồng lấn. Kiểm tra độc lập cho thấy một measurement cách thời điểm kết thúc
mixing 60 giây vẫn trả `invalidReasons=[]`.

Test số 27 hiện chỉ gọi helper với `tdsControlValid=false`; nó không chứng minh rằng
measurement trước `mixingUntil` bị chặn và cũng không kiểm tra DB không ghi delta giả.

Yêu cầu sửa:

- Lưu `measurementAt` rõ trong `devices.latest`/quality contract.
- Chỉ finalize khi `measurementAt > mixingUntil` (và nên lớn hơn thời điểm Pump B
  completed/mixing started).
- Lưu `tdsCalibrationSetIdAtStart` trong run và kiểm tra active pointer/set hiện tại
  trước khi finalize.
- Nếu chưa có measurement sau mixing, giữ `mixing_wait`, ghi reason riêng và không
  tạo `tdsPpmAfterMixing`/`deltaTdsPpm`.
- Thêm behavioral test chạy qua `evaluateAutoDosing()` với fake repository/DB.

### P1 — Race/idempotency có thể tạo nhiều run hoặc publish Pump B lặp

MQTT callback là async nhưng EventEmitter không serialize các callback. Trong khi đó:

- `evaluateAutoDosing()` thực hiện `getActiveDosingRun()` rồi mới `insertOne()` run;
  không có atomic reservation hoặc unique partial index bảo đảm một active run/device.
- `publishPumpBForRun()` tại `869-888` publish Pump B trước khi claim/update
  `pumpB.commandId` bằng điều kiện atomic.
- Hai test Pump A/B tại `test/autoDosingSafety.test.js:83-95` chỉ tìm chuỗi trong source,
  không mô phỏng trạng thái MQTT trùng hoặc hai callback concurrent.

Firmware có interlock giúp giảm rủi ro chạy đồng thời, nhưng không thay thế được
idempotency ở backend; status trùng hoặc timing xấu vẫn có thể tạo state sai hoặc lệnh
lặp.

Yêu cầu sửa:

- Dùng atomic claim/state transition trước publish.
- Chỉ một callback được đổi Pump B từ `pending` sang trạng thái `publishing` với
  command ID đã dành trước.
- Thêm cơ chế idempotency cho pump status/command ID.
- Bảo đảm một active dosing run/device bằng transaction, lock document hoặc unique
  partial index đã đánh giá dữ liệu legacy.
- Thêm test concurrent/duplicate status thực sự; bỏ việc coi static source search là
  bằng chứng regression đủ mạnh.

### P1 — Lifecycle calibration chưa atomic và rollback chưa đầy đủ

Codex đã tự ghi nhận chưa có `startSession()/withTransaction()`. Source hiện retire set
cũ, activate set mới, đổi device pointer và disable dosing qua nhiều write độc lập.

Ngoài thiếu transaction:

- Không kiểm tra `matchedCount/modifiedCount` của các transition.
- Nếu activation đầu tiên đã đổi pointer nhưng write disable settings ném lỗi, rollback
  đưa set mới về draft nhưng không có nhánh xóa pointer khi `previousSetId` không tồn tại.
- Hai activation concurrent có thể phá invariant một active set/device.

Flow vẫn có xu hướng fail-closed khi pointer trỏ set draft/retired, nhưng lifecycle có
thể không nhất quán và chưa đạt yêu cầu production.

Yêu cầu sửa:

- Thêm transaction path khi MongoDB topology hỗ trợ.
- Fallback phải kiểm tra kết quả từng write, rollback cả pointer khi không có set cũ và
  ghi audit lỗi rollback.
- Thêm failure-injection tests cho lỗi ở từng bước.
- Đánh giá unique partial index một active set/device sau khi audit dữ liệu hiện có.

### P1 — Migration legacy bỏ sót các row cần nhận diện

`scripts/migrateLegacyTdsCalibrations.js:16` chỉ query:

```js
{ calibrationSetId: { $exists: false } }
```

Do đó script bỏ qua:

- `calibrationSetId: null` hoặc chuỗi rỗng.
- Row có `calibrationSetId` nhưng thiếu EC/scale/nhiệt độ.
- Tổng số row cũ cần đếm/đối chiếu.

Yêu cầu sửa migration scan/classification để nhận diện mọi trường hợp trên, vẫn dry-run
mặc định, không suy ra scale 500 và không auto-activate.

### P2 — README backend còn nội dung cũ mâu thuẫn Phase 21

`03_Edge_Server/mqtt_backend/README.md:620-677` vẫn hướng dẫn:

- ngoại suy ngoài range;
- fallback raw voltage khi thiếu nhiệt độ;
- ppm-first;
- chỉ cần hai điểm;
- tái sử dụng điểm cũ;
- payload raw không đổi.

Các nội dung này trái trực tiếp với source Phase 21. Ngoài ra:

- `03_Edge_Server/mqtt_backend/README.md:818-822` còn curl legacy thiếu
  `calibrationSetId` và dùng
  `referenceTdsPpm`/method cũ, nên sẽ bị API mới từ chối.
- `03_Edge_Server/mqtt_backend/README.md:872-875` còn payload MQTT thiếu
  `tdsSampleCount`, `tdsSpreadRaw` và
  `tdsWindowStable`, nên validator mới sẽ từ chối.

Phải xóa hoặc gắn nhãn lịch sử rõ ràng và thay toàn bộ example bằng EC-first set APIs.

### P2 — Test report đang đánh giá quá cao độ bao phủ

37 test đều PASS, nhưng chưa thể xem là đã kiểm chứng đủ toàn bộ 30 scenario ở cấp
service/runtime:

- Test activate 1/2/3 điểm chỉ test `buildSetValidation()`, không gọi service activate.
- Test enable target chỉ gọi readiness helper, không gọi `updateAutoDosingSettings()`.
- Test post-mixing không chạy `evaluateAutoDosing()`/DB update.
- Hai regression Pump A/B chỉ tìm chuỗi source.
- Chưa có test lifecycle rollback, duplicate MQTT status, concurrent run, stable/count
  relationship hoặc measurement timestamp sau mixing.

Cần giữ các unit test hiện có nhưng bổ sung behavioral service tests với fake DB/repository
và failure injection.

### P2 — Status report chưa liệt kê đủ file theo `CODEX_INSTRUCTIONS.md`

`00_Docs/PROJECT_STATUS_REPORT.md` không liệt kê file mới
`03_Edge_Server/mqtt_backend/test/dashboardContract.test.js` trong mục Created Files.
Các artifact bàn giao/audit cũng không được phản ánh đầy đủ tại đây dù final report có
inventory riêng. Cần đồng bộ lại danh sách file sửa/tạo sau vòng fix.

## 6. Đánh giá báo cáo Codex

Các số liệu SHA, 122 entry, 37 test PASS, 32 syntax PASS, firmware chưa compile và
transaction chưa có là đúng.

Tuy nhiên các kết luận sau đang mạnh hơn bằng chứng thực tế:

- “Cover all 30 required scenarios” chưa đúng ở cấp hành vi; nhiều scenario chỉ test
  helper hoặc source string.
- “Measurement quality contract” chưa fail-closed do count/spread/stable mismatch.
- “Measurement mới valid after mixing” chưa được chứng minh bằng timestamp.
- “Documentation completed” chưa đúng vì README còn quy trình ppm-first/extrapolation
  và example payload/API cũ.

## 7. Quyết định vận hành hiện tại

- Chưa upload firmware Phase 21.
- Chưa tạo/activate calibration set thật.
- Chưa chạy migration trên database vận hành.
- Chưa bật Auto Dosing.
- Chưa nối chai dung dịch để thử tự động.
- Không dùng dữ liệu Hanna 1413 uS/cm chưa đo để tạo active set.

Giữ nguyên bốn xác nhận:

```text
Auto Dosing remains OFF.
No pump command was sent.
No live calibration set was activated.
No production database was modified.
```

## 8. Prompt sửa lỗi đề xuất gửi Codex

```text
Hãy thực hiện Phase 21 Fix Round 1 dựa trên audit độc lập, không mở rộng tính năng.

Mục tiêu bắt buộc:

1. Sửa measurement quality fail-closed:
   - Backend có named constants 30 samples và max spread 50 ADC.
   - Validator buộc:
     tdsWindowStable === (tdsSampleCount === 30 && tdsSpreadRaw <= 50).
   - Stability service tự kiểm tra count/spread, không chỉ tin boolean.
   - Thêm test count 0, 29, spread 51 và boolean mismatch.

2. Sửa post-mixing:
   - Lưu measurementAt trong sensor_logs và devices.latest.
   - Chỉ finalize khi measurementAt > mixingUntil và measurement valid for control.
   - Lưu/check calibrationSetId của run; active set hiện tại phải vẫn đúng và hợp lệ.
   - Nếu chưa có measurement mới, giữ mixing_wait, không ghi delta giả, không publish.
   - Viết behavioral tests qua evaluateAutoDosing và fake DB/repository.

3. Sửa race/idempotency bơm:
   - Atomic reserve một active run/device.
   - Atomic claim Pump B trước publish; duplicate Pump A completed không publish B lần hai.
   - Xử lý duplicate/out-of-order pump status bằng commandId/state transition.
   - Viết concurrency/duplicate tests; không dùng source-string search làm bằng chứng chính.

4. Hoàn thiện calibration lifecycle:
   - Thêm MongoDB transaction path khi topology hỗ trợ.
   - Fallback kiểm tra matchedCount/modifiedCount và rollback đầy đủ, kể cả first activation
     không có previousSetId.
   - Failure-injection tests cho từng write.
   - Không kết nối database thật trong quá trình test.

5. Sửa migration:
   - Audit cả missing/null/empty calibrationSetId.
   - Nhận diện row thiếu EC/scale/nhiệt độ dù calibrationSetId tồn tại.
   - Đếm tổng row và từng nhóm.
   - Default dry-run, zero-write test, không suy ra scale 500, không auto-activate.

6. Sửa toàn bộ tài liệu mâu thuẫn:
   - Xóa/đánh dấu lịch sử các đoạn ppm-first, extrapolation, fallback raw voltage,
     two-point và reuse legacy trong backend README.
   - Cập nhật mọi curl calibration sang calibration-set APIs + referenceEcUsCm.
   - Cập nhật manual MQTT payload với sampleCount/spread/windowStable.
   - Liệt kê mọi file sửa/tạo trong PROJECT_STATUS_REPORT.md.

7. Test bắt buộc:
   - npm test, node --check, git diff --check.
   - Giữ Auto Dosing OFF.
   - Không start service, không connect DB/MQTT thật, không activate set, không chạy bơm.
   - Firmware chỉ báo compile PASS nếu thực sự compile.

Tạo một báo cáo duy nhất:
CODEX_PHASE21_FIX1_FINAL_REPORT.md

Báo cáo phải phân biệt Completed / Partial / Not done / Not verified, chứa lệnh,
output summary, exit code, file/dòng bằng chứng, rủi ro còn lại và bốn xác nhận an toàn.
Không tuyên bố Phase 21 hoàn thành nếu bất kỳ P0/P1 nào còn mở.
```

## 9. Điều kiện để audit lại và chấp nhận

Chỉ chuyển sang compile/runtime khi:

1. Tất cả P0/P1 trên đã sửa và có behavioral tests PASS.
2. README/API/payload examples không còn mâu thuẫn.
3. Transaction/fallback lifecycle có failure-injection evidence.
4. Firmware compile thực sự PASS hoặc được ghi trung thực là chưa compile.
5. Auto Dosing vẫn OFF, không có active live set và không có thao tác production.
