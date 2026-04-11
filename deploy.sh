#!/usr/bin/env bash
set -euo pipefail

# ============================================
# HSIL Deployment Script for Ubuntu Droplet
# Run this ON the Droplet as root
# ============================================

REPO_DIR="/opt/hsil"
DATA_DIR="/opt/hsil-data"
VENV_DIR="$REPO_DIR/backend/.venv"

echo "==> Installing system packages..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv python3-pip nginx git curl

# Install Node.js 20 if not present
if ! command -v node &>/dev/null; then
    echo "==> Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

echo "==> Setting up data directory..."
mkdir -p "$DATA_DIR/images"

echo "==> Setting up Python venv..."
python3 -m venv "$VENV_DIR"
source "$VENV_DIR/bin/activate"

echo "==> Installing Python dependencies..."
cd "$REPO_DIR/backend"
pip install -q --upgrade pip
pip install -q -e .

echo "==> Creating .env if it doesn't exist..."
if [ ! -f "$REPO_DIR/backend/.env" ]; then
    SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    cat > "$REPO_DIR/backend/.env" <<ENVEOF
SECRET_KEY=$SECRET
DEBUG=false
DATABASE_URL=sqlite+aiosqlite:///$DATA_DIR/hsil.db
UPLOAD_DIR=$DATA_DIR/images
CORS_ORIGINS=http://$(hostname -I | awk '{print $1}')
OPENAI_API_KEY=
ENVEOF
    echo "    Created .env — edit it to add your OPENAI_API_KEY"
else
    echo "    .env already exists, skipping"
fi

echo "==> Building frontend..."
cd "$REPO_DIR/frontend"
npm ci --silent
npm run build

echo "==> Setting up Nginx..."
cat > /etc/nginx/sites-available/hsil <<'NGINXEOF'
server {
    listen 80;
    server_name _;

    # Frontend static files
    root /opt/hsil/frontend/dist;
    index index.html;

    # API proxy to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # SPA fallback — all non-API, non-file routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/hsil /etc/nginx/sites-enabled/hsil
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> Setting up systemd service for backend..."
cat > /etc/systemd/system/hsil-backend.service <<SVCEOF
[Unit]
Description=HSIL FastAPI Backend
After=network.target

[Service]
Type=exec
WorkingDirectory=$REPO_DIR/backend
ExecStart=$VENV_DIR/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3
EnvironmentFile=$REPO_DIR/backend/.env

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable hsil-backend
systemctl restart hsil-backend

echo ""
echo "============================================"
echo "  HSIL deployed!"
echo "  Visit: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "  Backend status: systemctl status hsil-backend"
echo "  Backend logs:   journalctl -u hsil-backend -f"
echo "  Nginx logs:     tail -f /var/log/nginx/error.log"
echo ""
echo "  IMPORTANT: Edit /opt/hsil/backend/.env to add"
echo "  your OPENAI_API_KEY for real inference."
echo "============================================"
