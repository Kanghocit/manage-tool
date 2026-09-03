# Quy trình deploy web — manage-tool (Production)

Tài liệu deploy đầy đủ cho VPS: **Backend (PM2)** + **Frontend (Nginx static)** + **GitHub Actions**.

---

## 1. Kiến trúc production

| Thành phần | Công nghệ | Đường dẫn / ghi chú |
|------------|-----------|---------------------|
| **API (BE)** | Node + Express, PM2 | `/var/www/manage-tool/be/dist/server.js` |
| **DB** | PostgreSQL + Prisma | Cấu hình trong `be/.env` |
| **Web (FE)** | Vite build → file tĩnh | `/var/www/manage-tool/fe/dist` |
| **Nginx** | Serve FE, proxy API | Domain web + `api.*` |
| **CI/CD** | GitHub Actions | Push nhánh `production` |

**Quan trọng:**

- PM2 **chỉ** chạy API — **không** serve giao diện React.
- Nginx `root` cho domain web **phải trỏ** `fe/dist` (không trỏ thư mục khác như `/var/www/ankhang` nếu build ở `manage-tool`).

---

## 2. Domain & path chuẩn (môi trường hiện tại)

| Mục | Giá trị |
|-----|---------|
| Repo trên VPS | `/var/www/manage-tool` |
| Nhánh deploy | `production` |
| Domain web | `https://ankhang.name.vn` |
| Domain API | `https://api.ankhang.name.vn` |
| Build FE env | `VITE_API_URL=https://api.ankhang.name.vn` |
| File Nginx site | `/etc/nginx/sites-available/ankhang.name.vn` |
| `root` FE (đúng) | `/var/www/manage-tool/fe/dist` |
| PM2 app name | `manage-tool-api` (mặc định) |

---

## 3. Setup VPS (chỉ làm một lần)

### 3.1. Cài Node 20, Git, PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y git nginx
sudo npm install -g pm2
```

### 3.2. Clone repo

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
git clone https://github.com/Kanghocit/manage-tool.git /var/www/manage-tool
cd /var/www/manage-tool
git checkout production
```

### 3.3. Cấu hình Backend `.env`

```bash
cp be/.env.example be/.env
nano be/.env
```

Chỉnh tối thiểu: `DATABASE_URL`, `JWT_*`, `CORS_ORIGINS`, `SEPAY_*`, port API (mặc định 4000), v.v.

> `.env` nằm tại **`be/.env`**, không phải file `.env` rỗng ở root repo.

### 3.4. PM2 lần đầu

```bash
cd /var/www/manage-tool
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# Chạy lệnh sudo mà pm2 startup in ra
```

Kiểm tra:

```bash
pm2 describe manage-tool-api | grep cwd
# Phải: /var/www/manage-tool/be
```

### 3.5. Nginx — site web + API

Sửa file:

```bash
sudo nano /etc/nginx/sites-available/ankhang.name.vn
```

**Block web** (`server_name ankhang.name.vn`):

```nginx
server {
    listen 80;
    listen 443 ssl;
    server_name ankhang.name.vn;

    root /var/www/manage-tool/fe/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # SSL: certbot đã cấu hình thì giữ nguyên các dòng ssl_certificate...
}
```

**Block API** (`server_name api.ankhang.name.vn`):

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
}

location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Bật site & test:

```bash
sudo ln -sf /etc/nginx/sites-available/ankhang.name.vn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3.6. SSH key cho GitHub Actions

Trên máy local hoặc VPS, tạo key deploy (nếu chưa có), thêm public key vào `~/.ssh/authorized_keys` của user deploy trên VPS.

---

## 4. GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Ví dụ / mô tả |
|--------|----------------|
| `SSH_HOST` | IP VPS |
| `SSH_USER` | `root` hoặc user có quyền git/npm/pm2 |
| `SSH_PRIVATE_KEY` | Private key SSH |
| `SSH_PORT` | `22` (tuỳ chọn) |
| `DEPLOY_PATH` | **`/var/www/manage-tool`** |
| `VITE_API_URL` | **`https://api.ankhang.name.vn`** |
| `PM2_APP_NAME` | `manage-tool-api` (tuỳ chọn) |

---

## 5. Deploy tự động (khuyến nghị)

### 5.1. Trên máy dev

```bash
git checkout production
git pull origin production
# merge / commit code mới
git push origin production
```

### 5.2. Trên GitHub

1. Vào **Actions** → workflow **Deploy production**.
2. Đảm bảo **cả hai job** thành công:
   - **Verify build** (build thử trên GitHub)
   - **Deploy to VPS** (SSH chạy script trên server)
3. Log deploy trên VPS phải có: `==> Deploy finished OK`.

### 5.3. Script deploy trên VPS làm gì?

File: `scripts/deploy-production.sh`

1. `git fetch` + `git reset --hard origin/production`
2. **Backend:** `npm ci` → `prisma generate` → `npm run build` → `prisma migrate deploy`
3. **Frontend:** `npm ci` → `VITE_API_URL=... npm run build` → tạo `fe/dist`
4. **PM2:** `pm2 reload ecosystem.config.cjs`

---

## 6. Deploy tay trên VPS

Khi cần deploy lại không qua GitHub:

```bash
ssh root@<IP-VPS>
cd /var/www/manage-tool
export DEPLOY_PATH=/var/www/manage-tool
export VITE_API_URL=https://api.ankhang.name.vn
bash scripts/deploy-production.sh
```

Chờ đến dòng **`==> Deploy finished OK`**. Không bấm Ctrl+C giữa `npm ci`.

Sau deploy:

```bash
sudo nginx -t && sudo systemctl reload nginx   # nếu vừa sửa nginx
```

Trình duyệt: **Ctrl+Shift+R** (hard refresh).

---

## 7. Checklist sau mỗi lần deploy

```bash
# 1) Git đúng commit
cd /var/www/manage-tool && git log -1 --oneline

# 2) FE đã build
ls -la /var/www/manage-tool/fe/dist/index.html

# 3) Nginx trỏ đúng FE (quan trọng!)
sudo nginx -T 2>/dev/null | grep -E 'server_name ankhang|root '

# 4) PM2 đúng path (không còn /root/manage-tool)
pm2 describe manage-tool-api | grep cwd

# 5) API sống (thay endpoint nếu project có route health khác)
curl -sI https://api.ankhang.name.vn/
```

DevTools → tab **Network** → file `index-*.js` — hash phải khớp file trong `fe/dist/assets/`.

---

## 8. Lỗi thường gặp & cách xử lý

### 8.1. GitHub xanh nhưng web không đổi

- Chỉ job **Verify** xanh, job **Deploy** fail → xem log SSH/secrets.
- `DEPLOY_PATH` sai → script `cd` lỗi.
- Nginx `root` vẫn `/var/www/ankhang` trong khi build ở `manage-tool/fe/dist` → **sửa `root`** hoặc `rsync` dist sang `/var/www/ankhang`.

### 8.2. `cd: /var/www/manage-tool: No such file or directory`

- Clone repo vào đúng path hoặc sửa `DEPLOY_PATH` + GitHub Secret cho khớp.

### 8.3. `Cannot find module '../encodings'` + path `/root/manage-tool`

- PM2/node_modules cũ ở path đã xóa.

```bash
pm2 delete all
rm -rf /root/manage-tool
cd /var/www/manage-tool/be
rm -rf node_modules && npm ci && npm run build
cd /var/www/manage-tool && pm2 start ecosystem.config.cjs && pm2 save
```

### 8.4. `fe/dist` không có trên VPS

- Deploy bị cắt trước bước Frontend.

```bash
cd /var/www/manage-tool/fe
npm ci
VITE_API_URL=https://api.ankhang.name.vn npm run build
```

### 8.5. `nginx -t` lỗi `unexpected ";"` dòng 4

- Sửa typo trong `/etc/nginx/sites-available/ankhang.name.vn` (thừa `;;`, thiếu path, sai block).

```bash
sudo nl -ba /etc/nginx/sites-available/ankhang.name.vn | head -20
```

### 8.6. Chạy `ls` trên Mac thấy không có `/var/www/...`

- Path `/var/www/manage-tool` chỉ có trên **VPS Linux**, không có trên Mac local.

### 8.7. Đồng bộ FE sang `/var/www/ankhang` (tạm, không khuyến nghị)

Nếu chưa sửa Nginx `root`:

```bash
rsync -a --delete /var/www/manage-tool/fe/dist/ /var/www/ankhang/
```

Mỗi lần deploy phải chạy lại — nên sửa Nginx trỏ thẳng `manage-tool/fe/dist`.

---

## 9. Luồng tóm tắt

```text
[Dev] commit → push origin/production
        ↓
[GitHub Actions] Verify build → Deploy SSH
        ↓
[VPS] deploy-production.sh
        ├─ git pull production
        ├─ build be → PM2 reload
        └─ build fe → fe/dist
        ↓
[Nginx] root → /var/www/manage-tool/fe/dist
[Browser] ankhang.name.vn
[API]     api.ankhang.name.vn → PM2 :4000
```

---

## 10. Lệnh nhanh (copy)

```bash
# Deploy tay
export DEPLOY_PATH=/var/www/manage-tool
export VITE_API_URL=https://api.ankhang.name.vn
bash /var/www/manage-tool/scripts/deploy-production.sh

# Chỉ build FE
cd /var/www/manage-tool/fe && npm ci && VITE_API_URL=https://api.ankhang.name.vn npm run build

# Test nginx & reload
sudo nginx -t && sudo systemctl reload nginx
```

---

## Tài liệu liên quan

- `DEPLOY.md` — tóm tắt CI/CD và secrets
- `scripts/deploy-production.sh` — script deploy trên VPS
- `.github/workflows/deploy-production.yml` — GitHub Actions

---

*Cập nhật theo VPS `khang-zalo-tool-prd`, repo `Kanghocit/manage-tool`, nhánh `production`.*
