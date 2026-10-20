# Các bước GitHub đúng yêu cầu đề

## Bước 1: Khởi tạo
```bash
git init
git branch -M main
git add .
git commit -m "Initial commit: Create chat app with PostgreSQL"
```

## Bước 2: Commit 1 - Nginx
```bash
git add .
git commit -m "Commit 1: Configure Nginx reverse proxy and security headers"
```

## Bước 3: Commit 2 - Monitoring
```bash
git add .
git commit -m "Commit 2: Add Prometheus and Grafana monitoring"
```

## Bước 4: Commit 3 - Logging
```bash
git add .
git commit -m "Commit 3: Add centralized logging with Loki and Promtail"
```

## Bước 5: Hardening + README
```bash
git add .
git commit -m "Final: Apply system hardening and complete README"
```

## Push
```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```
