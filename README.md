# IoT Control Center

Ứng dụng web giám sát cảm biến và điều khiển thiết bị IoT theo thời gian thực.

- **Frontend:** React 19, Vite, Chart.js, Axios và Socket.IO Client
- **Backend:** Node.js, Express 5, MySQL, MQTT.js và Socket.IO
- **Thiết bị:** ESP8266 giao tiếp với backend qua MQTT
- **Màn hình:** Đăng nhập, Dashboard, dữ liệu cảm biến, lịch sử thiết bị và hồ sơ cá nhân

## Kiến trúc hệ thống

```text
ESP8266 <── MQTT ──> Mosquitto <── MQTT ──> Node.js/Express <──> MySQL
                                               │
                                               ├── REST API ──> React
                                               └── Socket.IO ─> React
```

Hệ thống sử dụng ba MQTT topic:

| Topic | Publisher | Subscriber | Payload mẫu |
| --- | --- | --- | --- |
| `iot/sensors/data` | ESP8266 | Backend | `{"temperature":28.5,"humidity":71,"light":645}` |
| `iot/devices/command` | Backend | ESP8266 | `1:ON`, `2:OFF` |
| `iot/devices/status` | ESP8266 | Backend | `{"device":1,"status":"ON"}` |

### Luồng điều khiển thiết bị

1. Backend tạo một bản ghi `action_history` với trạng thái `PENDING` rồi gửi lệnh qua `iot/devices/command`.
2. Khi ESP8266 phản hồi qua `iot/devices/status`, backend chuyển yêu cầu sang `SUCCESS`, cập nhật `devices.status` và phát sự kiện Socket.IO.
3. Nếu không nhận được phản hồi trong 5 giây, yêu cầu chuyển sang `FAILED`; trạng thái thiết bị trước đó được giữ nguyên.

## Cấu trúc thư mục

```text
iot-control-center-updated/
├── backend/
│   ├── src/
│   │   ├── config/          # Kết nối MySQL
│   │   ├── middleware/      # Xác thực JWT
│   │   ├── routes/          # REST API
│   │   ├── services/        # Kết nối và xử lý MQTT
│   │   ├── utils/           # Tiện ích truy vấn và HTTP
│   │   └── server.js        # Điểm khởi chạy backend
│   └── package.json
├── frontend/
│   ├── public/              # Tài nguyên tĩnh
│   ├── src/
│   │   ├── api/             # REST API và Socket.IO client
│   │   ├── components/      # Component dùng chung
│   │   ├── context/         # Trạng thái xác thực
│   │   ├── pages/           # Các màn hình chính
│   │   └── styles/          # CSS toàn cục
│   └── package.json
└── README.md
```

## Yêu cầu

- Node.js 20 trở lên (khuyến nghị Node.js 22)
- MySQL 8.x
- Mosquitto MQTT Broker
- Cơ sở dữ liệu `iot_monitoring` với các bảng: `users`, `sensors`, `sensor_data`, `devices` và `action_history`
- ESP8266 cùng cảm biến DHT11, LDR và các thiết bị đầu ra nếu chạy với phần cứng thật

## REST API

| Phương thức | Endpoint | Mô tả |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Đăng nhập và nhận JWT |
| `GET` | `/api/health` | Kiểm tra API, database và MQTT |
| `GET` | `/api/sensor-data/latest` | Lấy dữ liệu cảm biến mới nhất |
| `GET` | `/api/sensor-data/chart?limit=20` | Lấy dữ liệu biểu đồ trong một phút gần nhất |
| `GET` | `/api/sensor-data/history` | Tra cứu lịch sử cảm biến có phân trang |
| `GET` | `/api/sensor-data/sensors` | Lấy danh sách cảm biến |
| `GET` | `/api/devices` | Lấy danh sách thiết bị |
| `GET` | `/api/devices/:deviceId/status` | Lấy trạng thái một thiết bị |
| `POST` | `/api/devices/:deviceId/control` | Gửi lệnh `ON` hoặc `OFF` |
| `GET` | `/api/devices/action-history` | Tra cứu lịch sử điều khiển có phân trang |