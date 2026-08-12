# CHECKLIST DEMO AUTO DOSING V2

## 1. Kiểm tra an toàn trước demo

- [ ] Xác nhận Auto Dosing đang ở trạng thái OFF.
- [ ] Kiểm tra đúng vị trí đầu ra của bơm A và bơm B.
- [ ] Xác nhận không có ống bơm dinh dưỡng đặt nhầm vào bồn hoặc cốc thử.
- [ ] Kiểm tra bơm hồi lưu có thể bật và tắt từ Dashboard.
- [ ] Xác nhận mực nước đang ở trạng thái `normal`.
- [ ] Chờ giá trị TDS ổn định trước khi bắt đầu.
- [ ] Kiểm tra đầu dò TDS sạch và không có bọt khí bám.
- [ ] Xác nhận hiệu chuẩn lưu lượng bơm A và bơm B đã sẵn sàng.
- [ ] Xác nhận `requireMainPumpOn=true`.
- [ ] Kiểm tra giới hạn liều trong ngày trước khi demo.
- [ ] Chuẩn bị cốc đo, nước sạch và phương án ngắt nguồn bơm khi cần.

## 2. Demo điều khiển thủ công

- [ ] Mở Dashboard và trình bày dữ liệu cảm biến hiện tại.
- [ ] Chỉ ra TDS, nhiệt độ nước, mực nước và trạng thái các bơm.
- [ ] Bật bơm hồi lưu bằng nút **Turn Main Pump ON**.
- [ ] Xác nhận trạng thái bơm hồi lưu chuyển sang ON.
- [ ] Tắt bơm hồi lưu bằng nút **Turn Main Pump OFF**.
- [ ] Xác nhận trạng thái bơm hồi lưu chuyển sang OFF.
- [ ] Nếu điều kiện an toàn cho phép, trình diễn một lệnh pulse ngắn cho bơm A hoặc bơm B bằng nước sạch.
- [ ] Trình bày bằng chứng lệnh `set/on` của Pump A bị từ chối.
- [ ] Trình bày bằng chứng lệnh `set/on` của Pump B bị từ chối.
- [ ] Chỉ ra thông báo: `Rejected: set action is only allowed for main pump`.

## 3. Demo Auto Dosing V2

### Cấu hình an toàn

- [ ] Giữ Auto Dosing OFF trong lúc nhập cấu hình.
- [ ] Đặt `stepDoseMlPerPump = 1`.
- [ ] Đặt `maxDoseMlPerPumpPerRun = 1`.
- [ ] Đặt `maxDailyDoseMlPerPump = 1` cho một lần demo.
- [ ] Đặt `requireMainPumpOn = true`.
- [ ] Dùng `mixingDelayMs = 60000` chỉ cho demo bằng nước sạch hoặc cốc thử.
- [ ] Dùng `mixingDelayMs = 900000` khi thử với dung dịch dinh dưỡng thật.
- [ ] Không sử dụng liều lớn hoặc dosing một lần không giới hạn.

### Trình tự demo

- [ ] Bật bơm hồi lưu và xác nhận trạng thái ON.
- [ ] Xác nhận mực nước `normal`.
- [ ] Xác nhận TDS hiện tại thấp hơn `targetMinPpm` dùng cho demo.
- [ ] Bật Auto Dosing sau khi đã kiểm tra toàn bộ điều kiện.
- [ ] Quan sát Pump A được thực hiện trước.
- [ ] Quan sát Pump B chỉ được thực hiện sau khi Pump A hoàn tất.
- [ ] Xác nhận dosing run chuyển sang `mixing_wait`.
- [ ] Xác nhận không có run thứ hai trong thời gian chờ trộn.
- [ ] Sau thời gian trộn và sensor payload tiếp theo, xác nhận run chuyển sang `completed`.
- [ ] Kiểm tra `tdsPpmAtStart`, `tdsPpmAfterMixing` và `deltaTdsPpm`.
- [ ] Xác nhận giới hạn liều trong ngày ngăn bước dosing tiếp theo.

## 4. Demo chức năng giám sát

- [ ] Trình bày **Auto Dosing Safety Summary**.
- [ ] Trình bày trạng thái Enabled/Disabled và Current State.
- [ ] Trình bày trạng thái bơm hồi lưu, mực nước và hiệu chuẩn bơm A/B.
- [ ] Trình bày **Daily Dose Usage** gồm used, maximum và remaining.
- [ ] Trình bày **Active Run** hoặc **Latest Completed V2 Run**.
- [ ] Trình bày bảng **Dosing Runs** và sự khác nhau giữa V1 legacy và V2 `closed_loop_step`.
- [ ] Trình bày **Auto Dosing Event Log**.
- [ ] Chỉ ra ví dụ sự kiện `disabled`, `settings_updated` hoặc `main_pump_not_running`.
- [ ] Tải file **Dosing Runs CSV**.
- [ ] Tải file **Nutrient Response Tests CSV**.
- [ ] Tải file **Auto Dosing Events CSV**.
- [ ] Mở nhanh file CSV để xác nhận có dữ liệu.

## 5. Kết thúc demo

- [ ] Tắt Auto Dosing ngay sau khi demo.
- [ ] Xác nhận Dashboard hiển thị Auto Dosing = Disabled.
- [ ] Kiểm tra không có lệnh Pump A/B mới sau khi tắt.
- [ ] Giữ hoặc tắt bơm hồi lưu tùy nhu cầu tuần hoàn sau demo.
- [ ] Lưu hoặc xuất các bằng chứng cần thiết.
- [ ] Ghi lại thời gian demo, cấu hình và điều kiện bồn/cốc thử.
- [ ] Ghi lại TDS trước, TDS sau và độ thay đổi.
- [ ] Ghi nhận mọi dao động cảm biến, bọt khí hoặc hiện tượng bất thường.
- [ ] Không reset bộ đếm liều nếu chưa ghi nhận lượng dinh dưỡng thực tế đã châm.

## Cảnh báo bắt buộc

> Reset bộ đếm liều không loại bỏ lượng dinh dưỡng đã được bơm vào bồn. Auto Dosing phải ở trạng thái OFF mặc định và chỉ được bật trong demo có giám sát hoặc điều kiện vận hành được kiểm soát.
