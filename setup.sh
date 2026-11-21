#!/bin/bash
set -e

echo "========================================"
echo "  Night Host - VPS Setup Script"
echo "========================================"

# Update system
apt-get update -y

# Install Node.js 20 via NodeSource
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node.js version: $(node -v)"

# Install Python3
if ! command -v python3 &> /dev/null; then
  echo "Installing Python3..."
  apt-get install -y python3 python3-pip
fi
echo "Python3 version: $(python3 --version)"

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi
echo "PM2 version: $(pm2 --version)"

# Install ufw if not present
if ! command -v ufw &> /dev/null; then
  apt-get install -y ufw
fi

# Set working directory
NIGHTHOST_DIR="/home/connect/nighthost"
cd "$NIGHTHOST_DIR"

# Install backend dependencies
echo "Installing backend dependencies..."
cd "$NIGHTHOST_DIR/backend"
npm install --production

# Install frontend dependencies and build
echo "Installing frontend dependencies and building..."
cd "$NIGHTHOST_DIR/frontend"
npm install
npm run build

# Create the public directory for Express to serve
mkdir -p "$NIGHTHOST_DIR/public"

# vite.config.js sets outDir: '../public' (relative to frontend/),
# so the build already lands in $NIGHTHOST_DIR/public — nothing to copy.

# Create bots directory
mkdir -p /home/nighthost/bots
chmod 755 /home/nighthost/bots

# Generate JWT secret and write .env
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
DB_PATH="$NIGHTHOST_DIR/backend/nighthost.db"

cat > "$NIGHTHOST_DIR/backend/.env" << EOF
JWT_SECRET=$JWT_SECRET
BOT_BASE_PATH=/home/nighthost/bots
PORT=3000
DB_PATH=$DB_PATH
EOF

echo "Generated .env file"

# Allow port 3000 through firewall
echo "Configuring firewall..."
ufw allow 3000/tcp || true

# Stop existing panel if running
pm2 delete nighthost-panel 2>/dev/null || true

# Start the panel with PM2
cd "$NIGHTHOST_DIR"
pm2 start backend/src/index.js --name nighthost-panel --cwd "$NIGHTHOST_DIR"
pm2 save

# Set up PM2 to start on boot
PM2_STARTUP=$(pm2 startup | tail -n 1)
if [[ "$PM2_STARTUP" == sudo* ]]; then
  eval "$PM2_STARTUP"
fi

echo ""
echo "========================================"
echo "  Night Host is live!"
echo "  http://hk.meowlix.in:3000"
echo "  Default admin: admin / admin123"
echo "========================================"
