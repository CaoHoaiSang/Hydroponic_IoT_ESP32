# MAIN REPORT PHASE 20D DOCX UPDATE REVIEW

## 1. Mục đích

Tài liệu này tóm tắt thay đổi đã thực hiện trực tiếp trên báo cáo chính để ChatGPT Web hoặc người phản biện kiểm tra Phase 20D.

Phạm vi công việc chỉ gồm cập nhật tài liệu. Không sửa ESP32 firmware, backend, Dashboard, MQTT, MongoDB hoặc logic Auto Dosing.

## 2. Tệp nguồn và tệp đầu ra

- Tệp nguồn được giữ nguyên:
  `D:\Năm 4\HK2\Khoá Luận Tốt Nghiệp\Thuy_Canh4_Hybrid_Local_First_CapNhat_GiaiTrinhKyThuat_BoSungTinhChinh.docx`
- Bản backup trước Phase 20D:
  `D:\Năm 4\HK2\Khoá Luận Tốt Nghiệp\Thuy_Canh4_Hybrid_Local_First_CapNhat_GiaiTrinhKyThuat_BoSungTinhChinh_BACKUP_BEFORE_PHASE20D.docx`
- Báo cáo đã cập nhật:
  `D:\Năm 4\HK2\Khoá Luận Tốt Nghiệp\Thuy_Canh4_Hybrid_Local_First_CapNhat_GiaiTrinhKyThuat_BoSungTinhChinh_PHASE20D_UPDATED.docx`

SHA256 của tệp nguồn và backup giống nhau:

```text
EECD4D8A62C3E495A31EC679C6FF7A9A91028E2452E2EBDB23321ABFBD1E6157
```

SHA256 của báo cáo đã cập nhật:

```text
E3DCECF0A2B0565B12618627F454D675B26B122FBF2812C99A4AEA9D9BBE4F52
```

## 3. Các phần đã cập nhật

### 3.1. Phạm vi và trạng thái đề tài

- Cập nhật trọng tâm hiện tại để ghi nhận Auto Dosing V2 đã được kiểm chứng ở mức nguyên mẫu có giám sát.
- Chuyển nội dung "Auto Dosing sẽ triển khai sau" thành hướng "hoàn thiện Auto Dosing V2 cho vận hành dài hạn".
- Giữ pH, Adaptive Dosing, AI Camera, Zalo OA Notification Service và bảo mật Cloud/Fleet trong phạm vi phát triển sau.

### 3.2. Mục 5.3 - Local Operational Database

- Mở rộng trường của `auto_dosing_settings`.
- Mở rộng trường của `dosing_runs` cho closed-loop step dosing.
- Thêm `nutrient_response_tests`.
- Thêm `auto_dosing_events`.
- Giữ Local Operational Database là Source of Truth cho vận hành tại chỗ.

### 3.3. Mục 7 - Chế độ vận hành và phạm vi triển khai

Dòng `Rule-based Auto Dosing` được cập nhật thành:

- Giai đoạn: đã triển khai và kiểm chứng nguyên mẫu có giám sát.
- Nơi chạy: Hydroponic Edge AI Gateway / Local Control Server.
- Cơ chế: closed-loop step dosing, bơm A rồi bơm B, chờ trộn và đọc lại TDS.
- Auto Dosing mặc định OFF.
- Không châm một liều lớn duy nhất.
- Không phụ thuộc Cloud để điều khiển thời gian thực.

### 3.4. Mục 8 mới

Đã thêm mục:

`8. Kết quả triển khai và kiểm chứng Auto Dosing V2`

Gồm các mục con:

1. `8.1. Điều khiển liên tục bơm hồi lưu chính`
2. `8.2. Cơ chế an toàn đối với bơm dinh dưỡng A/B`
3. `8.3. Kết quả Nutrient Response Test`
4. `8.4. Chuỗi closed-loop step dosing`
5. `8.5. Kết quả chạy thật với dung dịch dinh dưỡng`
6. `8.6. Các cơ chế an toàn đã kiểm chứng`
7. `8.7. Kết quả Dashboard giám sát Phase 20C`
8. `8.8. Giới hạn của nguyên mẫu`
9. `8.9. Kết luận giai đoạn`

## 4. Số liệu đã đưa vào báo cáo

### Nutrient Response Test 4

| Thông số | Kết quả |
|---|---|
| Mức dung dịch | 16 L |
| Nguồn cấp cảm biến TDS | 5 V |
| Bơm hồi lưu | Bật |
| Auto Dosing | Tắt |
| Liều | 1 ml A + 1 ml B |
| Thời gian bơm | A 500 ms, B 556 ms |
| Thời gian trộn | 15 phút |
| Dashboard | 406,23 -> 427,28 ppm, +21,05 ppm |
| Bút đo chính | 535 -> 573 ppm, +38 ppm |
| Bút đo phụ | 449 -> 462 ppm, +13 ppm |

### Auto Dosing V2 thực tế

| Thông số | Kết quả |
|---|---|
| Chế độ | `closed_loop_step` |
| Trạng thái | `completed` |
| TDS trước | 302,27 ppm |
| TDS sau trộn | 348,88 ppm |
| Độ tăng | +46,61 ppm |
| Pump A | 1 ml, 500 ms, completed |
| Pump B | 1 ml, 556 ms, completed |
| Thời gian trộn | 15 phút |
| Mực nước | `normal` |
| Nhãn kết quả | `positive_response` |

## 5. Cơ chế an toàn được ghi nhận

- Bơm hồi lưu chính hỗ trợ `set/on` và `set/off`.
- Pump A/B chỉ nhận lệnh `pulse`.
- Pump A/B từ chối `set/on` với thông báo:
  `Rejected: set action is only allowed for main pump`.
- Auto Dosing mặc định OFF.
- Dosing yêu cầu mực nước normal, dữ liệu cảm biến hợp lệ, hiệu chuẩn bơm hợp lệ và không có run đang hoạt động.
- Khi `requireMainPumpOn=true` nhưng bơm chính OFF, hệ thống ghi `main_pump_not_running` và không dosing.
- Bơm A rồi mới đến bơm B; không chạy đồng thời trong chuỗi dosing.
- Không tạo run mới trong `mixing_wait`.
- Có giới hạn liều mỗi bước, mỗi run và tổng liều trong ngày.

## 6. Kiến trúc được giữ nhất quán

- Hybrid Local-first
- Hydroponic Edge AI Gateway
- Local Control Server
- Local Operational Database
- Fleet Management Cloud
- Fleet Management Web Portal
- Zalo OA Notification Service

Cloud không điều khiển bơm thời gian thực. Hydroponic Edge AI Gateway và Local Operational Database tiếp tục là thành phần điều khiển và nguồn dữ liệu vận hành cốt lõi tại vườn.

## 7. Kết quả kiểm tra tài liệu

- DOCX mở lại bằng Microsoft Word: Passed.
- Kiểm tra cấu trúc ZIP/OOXML: Passed.
- Số trang sau cập nhật: 18.
- Số bảng: 14.
- Hình ảnh cũ được giữ nguyên: 5 inline images và 1 shape.
- Đã render và kiểm tra trực quan toàn bộ 18 trang.
- Không phát hiện bảng tràn lề, chữ bị cắt hoặc nội dung chồng lấn.
- Không phát hiện ký tự mojibake `Ã`, `Â` hoặc `�`.
- Hai câu mô tả Auto Dosing là công việc chưa triển khai đã được loại bỏ.

## 8. Điểm cần người phản biện lưu ý

- Auto Dosing V2 mới được xác nhận ở mức nguyên mẫu rule-based có giám sát.
- Kết quả không đại diện cho vận hành tự động dài hạn không giám sát.
- Auto Dosing phải tiếp tục mặc định OFF.
- Cảm biến pH, Adaptive Dosing, AI Camera, Zalo OA Notification Service, xác thực người dùng và bảo mật Cloud/Fleet hoàn chỉnh vẫn chưa triển khai.
