# HydroFlow Local Integration

Gói này được tạo từ `feature/integrate-ui` tại commit `30d0b34c4bb00720dd5154beac96bbc2ed7389a2` và tích hợp giao diện HydroFlow từ source commit `4bb74fe7cde485827bd7dc7bcf3df33e0841e7dd`.

## Chạy nhanh trên Windows

1. Cài [Node.js 20 LTS hoặc mới hơn](https://nodejs.org/).
2. Giải nén toàn bộ ZIP vào một thư mục không dấu, ví dụ `D:\HydroFlow`.
3. Nhấp đúp `START_FRONTEND_ONLY.bat`.
4. Trình duyệt mở `http://localhost:5173`.

Frontend-only sẽ hiển thị `Chưa kết nối Backend`. Đây là trạng thái đúng, không tự thay dữ
liệu điều khiển bằng mock và mọi actuator đều khóa fail-closed.

## Chạy cùng Backend thật

1. Mở `services.msc` và bảo đảm MongoDB cùng Mosquitto đang chạy.
2. Đóng cửa sổ `START_FRONTEND_ONLY` nếu đang chạy và cần sửa/cài lại dependency.
3. Nhấp đúp `START_FULL_LOCAL.bat`.
4. Chờ dòng `Dashboard available`, sau đó trình duyệt tự mở
   `http://127.0.0.1:3001/overview`.
5. Khi muốn dừng, nhấn `Ctrl+C` trong cửa sổ Backend.

Launcher full-local luôn dùng dịch vụ loopback: MongoDB `127.0.0.1:27017`, MQTT
`127.0.0.1:1883`, Backend `127.0.0.1:3001`. Profile này ép actuator khóa, pump command
disabled, Shadow Mode disabled và Auto Dosing OFF. Không cần tạo `.env` để chạy profile local
an toàn mặc định.

Backend Express phục vụ REST API trước, sau đó phục vụ SPA tĩnh từ `03_Edge_Server/frontend/dist`. Deep-link không thuộc `/api/*` hoặc `/health` được trả về `index.html`.

## Chạy bằng terminal

```powershell
cd 03_Edge_Server\frontend
npm ci
npm run dev
```

Build production:

```powershell
npm run test
npm run lint
npm run type-check
npm run build
npm run test:e2e
```

Backend regression:

```powershell
cd ..\mqtt_backend
npm ci
npm test
```

## Khắc phục lỗi START_FULL_LOCAL

Launcher mới chạy preflight và in nguyên nhân cụ thể. Các lỗi thường gặp:

- `MongoDB is not listening`: mở `services.msc`, tìm dịch vụ MongoDB và chọn Start.
- `Mosquitto MQTT is not listening`: mở `services.msc`, tìm Mosquitto và chọn Start.
- `Port 3001 is used`: đóng Backend cũ hoặc tiến trình khác đang dùng cổng 3001.
- `Frontend dependencies are incomplete while port 5173 is active`: đóng cửa sổ
  `START_FRONTEND_ONLY`, rồi chạy lại full-local để `npm ci` sửa dependency.
- `tsc is not recognized`: launcher mới tự nhận ra cài đặt frontend chưa hoàn chỉnh và chạy
  `npm ci`; không còn chỉ kiểm tra sự tồn tại của thư mục `node_modules`.

Kiểm tra thủ công dịch vụ sau khi chạy:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
```

Kết quả đúng có `ok: true`, `mongoConnected: true` và `mqttConnected: true`.

## Nguyên tắc an toàn

- Production adapter không đọc query string để mở khóa actuator.
- Backend có `GET /api/system/capabilities`; mặc định trả về trạng thái khóa fail-closed.
- Manual Pump chỉ khả dụng khi metadata capability được xác minh ở server và cả publisher/service lock đã được gỡ có chủ đích.
- Auto Dosing Phase 22 luôn OFF; giao diện mới không có đường bật Auto Dosing.
- Activate calibration không phát lệnh bơm và luôn giữ Auto Dosing OFF.
- Capture measurement cho calibration chỉ chấp nhận quality contract ổn định từ Backend.
- Không có cloud deployment trong gói này.

## Phạm vi tích hợp

Đã dùng Backend thật:

- Health, capability metadata và snapshot `device001`.
- Danh sách 100 `sensor_logs` mới nhất, tự làm mới mỗi 5 giây.
- Calibration set EC/TDS và các CSV export đã có endpoint.
- Manual Main/Pump A/Pump B chỉ khi capability server xác minh; mặc định bị khóa.

Chưa tích hợp hoặc chỉ là mô hình giao diện:

- Zone/rack/season chỉ tồn tại trong state trình duyệt, chưa lưu Backend.
- AI và Cloud không có service, credential hay đường điều khiển.
- Biểu đồ lịch sử, resource metrics, connection inventory và thống kê tổng hợp chưa có endpoint.
- Auto Dosing settings/readiness/history trong React UI là chỉ đọc và luôn OFF.
- Sensor CSV được frontend tuần tự hóa từ API vì Backend chưa có endpoint CSV riêng.
