# Night Host - Deploy Script
# Run this from your Windows machine to deploy to the VPS

$VPS_HOST = "hk.meowlix.in"
$VPS_PORT = "2228"
$VPS_USER = "connect"
$VPS_PATH = "/home/connect/nighthost"
$LOCAL_PATH = "d:\Bot Hosting"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Night Host - Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check scp is available
if (-not (Get-Command scp -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: scp not found. Install OpenSSH or Git for Windows." -ForegroundColor Red
    exit 1
}

Write-Host "Uploading files to VPS..." -ForegroundColor Yellow

# Create remote directory first
ssh -p $VPS_PORT "${VPS_USER}@${VPS_HOST}" "mkdir -p $VPS_PATH"

# Upload project files (exclude node_modules, dist, .git)
scp -P $VPS_PORT -r `
  "$LOCAL_PATH\backend" `
  "$LOCAL_PATH\frontend" `
  "$LOCAL_PATH\setup.sh" `
  "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: File upload failed." -ForegroundColor Red
    exit 1
}

Write-Host "Files uploaded successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Running setup on VPS..." -ForegroundColor Yellow

# Make setup.sh executable and run it
ssh -p $VPS_PORT "${VPS_USER}@${VPS_HOST}" "chmod +x $VPS_PATH/setup.sh && sudo bash $VPS_PATH/setup.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: VPS setup failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "  Panel URL: http://hk.meowlix.in:3000" -ForegroundColor Green
Write-Host "  Admin login: admin / admin123" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
