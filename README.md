# Simple Chat / Messaging System

Đề tài thực hành môn **Triển khai và Quản trị Hệ thống Phần mềm**.

## Thành phần

- Node.js + Express + Socket.IO
- PostgreSQL
- pgAdmin
- Nginx Reverse Proxy
- Prometheus
- Grafana
- cAdvisor
- PostgreSQL Exporter
- Nginx Exporter
- Loki
- Promtail
- Docker Compose

## 1. Chuẩn bị

Cài:

- Docker Desktop
- Git

Sao chép file môi trường:

```bash
cp .env.example .env
```

Có thể sửa mật khẩu trong `.env`.

## 2. Chạy hệ thống

```bash
docker compose up -d --build
```

Kiểm tra:

```bash
docker compose ps
```

## 3. Địa chỉ truy cập

- Chat web: http://localhost
- pgAdmin: http://localhost:5050
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- cAdvisor: http://localhost:8080

## 4. Demo Chat

1. Mở cửa sổ trình duyệt 1, đăng ký tài khoản `user1`.
2. Mở cửa sổ ẩn danh, đăng ký `user2`.
3. Đăng nhập cả hai tài khoản.
4. Chọn người dùng và gửi tin nhắn realtime.

## 5. pgAdmin

Đăng nhập bằng tài khoản trong `.env`.

Tạo kết nối PostgreSQL:

- Host: `postgres`
- Port: `5432`
- Database: `chat_db`
- Username: `chat_user`
- Password: xem `.env`

## 6. Prometheus

Mở:

```text
http://localhost:9090/targets
```

Kiểm tra các target:

- chat-app
- cadvisor
- postgres-exporter
- nginx-exporter

## 7. Grafana

Mở:

```text
http://localhost:3001
```

Đăng nhập bằng tài khoản trong `.env`.

Datasource Prometheus và Loki đã được provision tự động.

## 8. LogQL demo

Vào Grafana -> Explore -> Loki.

Query 1:

```logql
{container="chat-app"}
```

Query 2:

```logql
{container="chat-nginx"}
```

Query 3:

```logql
{container="chat-app"} |= "message"
```

Có thể thử:

```logql
{container="chat-app"} |= "error"
```

## 9. Hardening đã áp dụng

- Backend chạy non-root (`USER node`).
- PostgreSQL không expose cổng 5432 ra host.
- Tách `frontend-net`, `backend-net`, `monitoring-net`.
- `backend-net` đặt `internal: true`.
- Password người dùng được băm bằng bcrypt.
- Nginx có các security headers.
- Backend filesystem đặt `read_only: true`.
- File cấu hình mount read-only.
- Secrets được tách sang `.env`, không commit `.env`.

## 10. Nginx Reverse Proxy

Luồng:

```text
Browser -> Nginx :80 -> chat-app :3000
```

## 11. Commit đề xuất

Initial commit:

```bash
git add .
git commit -m "Initial commit: Create chat app with PostgreSQL"
```

Sau khi xác nhận Nginx:

```bash
git add .
git commit -m "Commit 1: Configure Nginx reverse proxy and security headers"
```

Sau khi xác nhận Prometheus + Grafana:

```bash
git add .
git commit -m "Commit 2: Add Prometheus and Grafana monitoring"
```

Sau khi xác nhận Loki + Promtail:

```bash
git add .
git commit -m "Commit 3: Add centralized logging with Loki and Promtail"
```

Cuối cùng:

```bash
git add .
git commit -m "Final: Apply system hardening and complete README"
```

## 12. Dừng hệ thống

```bash
docker compose down
```

Xóa cả volume:

```bash
docker compose down -v
```

## 13. Lệnh kiểm tra hữu ích

```bash
docker compose ps
docker compose logs -f chat-app
docker compose logs -f nginx
docker compose logs -f prometheus
docker compose logs -f loki
```
