# Deploy production (CI/CD)

> Hướng dẫn chi tiết (VPS, Nginx, PM2, xử lý lỗi): **[DEPLOY-WEB.md](./DEPLOY-WEB.md)**

Push lên nhánh **`production`** → GitHub Actions tự build và deploy lên VPS (PM2 + Nginx).

## GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Mô tả |
|--------|--------|
| `SSH_HOST` | IP hoặc hostname VPS |
| `SSH_USER` | User SSH (có quyền `git`, `npm`, `pm2`) |
| `SSH_PRIVATE_KEY` | Private key (ed25519), public key trong `~/.ssh/authorized_keys` |
| `SSH_PORT` | (tuỳ chọn) mặc định `22` |
| `DEPLOY_PATH` | Thư mục clone repo, vd. `/var/www/manage-tool` |
| `VITE_API_URL` | URL API cho build FE, vd. `https://api.ankhang.name.vn` |
| `PM2_APP_NAME` | (tuỳ chọn) mặc định `manage-tool-api` |

## Setup VPS (một lần)

```bash
# Node 20 LTS + pm2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y git
sudo npm install -g pm2

# Clone
sudo mkdir -p /var/www/manage-tool
sudo chown $USER:$USER /var/www/manage-tool
git clone https://github.com/Kanghocit/manage-tool.git /var/www/manage-tool
cd /var/www/manage-tool
git checkout production

# Backend env (không commit)
cp be/.env.example be/.env
# chỉnh be/.env: DATABASE_URL, JWT_*, SEPAY_*, CORS_ORIGINS, ...

# PM2 lần đầu
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # làm theo hướng dẫn pm2 in ra
```

Nginx: root FE → `fe/dist`; proxy `/api` và `/hooks/sepay-payments` → `http://127.0.0.1:4000`.

## Deploy tay trên server

```bash
export DEPLOY_PATH=/var/www/manage-tool
export VITE_API_URL=https://api.ankhang.name.vn
bash scripts/deploy-production.sh
```

## Chạy workflow tay

GitHub → Actions → **Deploy production** → **Run workflow**.
