# Night Host

A self-hosted bot management panel for Discord bots written in Node.js or Python. Run it on your own VPS and control every bot from a single web interface.

---

## Overview

Night Host gives you a web panel to manage multiple Discord bots across multiple user accounts. From the panel you can:

- Create and manage bot projects
- Upload bot files via the browser
- Start, stop, and restart bots with one click
- View live console output (stdout/stderr) in real time
- Manage multiple users, each isolated in their own environment
- Monitor CPU and memory usage per bot

The backend runs on **Node.js + Express + SQLite**, the frontend on **React (Vite)**, and bots are process-managed by **PM2** under the hood.

---

## Quick Deploy (Windows PowerShell)

> Run PowerShell **as Administrator** so SSH/SCP can reach the VPS.

```powershell
cd "d:\Bot Hosting"
.\deploy.ps1
```

The script uploads all project files to the VPS and runs `setup.sh` remotely. When it finishes you will see the panel URL printed in green.

**Prerequisites on Windows:**
- OpenSSH client installed (comes with Windows 10/11) or Git for Windows
- SSH access to the VPS: `ssh connect@hk.meowlix.in -p 2228`

---

## Manual Deploy (fallback)

Use this if the PowerShell script fails or you prefer to do it step by step.

**1. Upload files from your Windows machine:**

```bash
scp -P 2228 -r backend frontend setup.sh connect@hk.meowlix.in:/home/connect/nighthost/
```

**2. SSH into the VPS:**

```bash
ssh connect@hk.meowlix.in -p 2228
```

**3. Run the setup script:**

```bash
sudo bash /home/connect/nighthost/setup.sh
```

The script installs all dependencies, builds the frontend, generates a JWT secret, configures the firewall, and starts the panel under PM2.

---

## Access the Panel

| Item | Value |
|---|---|
| URL | http://hk.meowlix.in:3000 |
| Default username | `admin` |
| Default password | `admin123` |

**Change your password immediately after the first login** via the account settings page.

---

## Features

- **Multi-user support** — each user has their own isolated bot directory and cannot access other users' bots
- **Bot management** — create, rename, and delete bot projects
- **File manager** — upload, browse, and edit bot files in the browser
- **Process control** — start, stop, and restart any bot with a single click
- **Live console** — real-time log streaming via WebSocket (Socket.io)
- **Resource monitor** — CPU and memory usage displayed per bot
- **Node.js bots** — runs with `node` or a custom start command
- **Python bots** — runs with `python3` or a custom start command
- **PM2 backing** — bots survive panel restarts and reboot automatically on VPS restart
- **JWT authentication** — session tokens, no plain-text passwords in cookies
- **Role system** — admin users can manage all bots and all users; regular users see only their own

---

## Adding a Bot

1. Log in to the panel at http://hk.meowlix.in:3000
2. Click **New Bot** in the sidebar
3. Enter a name and choose the runtime (Node.js or Python)
4. Set the start command, e.g. `node index.js` or `python3 bot.py`
5. Click **Create**
6. Open the bot's **Files** tab and upload your bot's source files
7. Go to the **Console** tab and click **Start**
8. Logs appear live in the console output panel

To stop or restart the bot, use the **Stop** / **Restart** buttons at the top of the bot page.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js 20, Express 4 |
| Database | SQLite 3 (via better-sqlite3) |
| Authentication | JWT (jsonwebtoken) |
| Real-time logs | Socket.io |
| Process manager | PM2 |
| Frontend | React 18, Vite |
| Styling | Tailwind CSS |
| VPS OS | Ubuntu 24.04 |

---

## Troubleshooting

**View live panel logs:**
```bash
pm2 logs nighthost-panel
```

**Restart the panel:**
```bash
pm2 restart nighthost-panel
```

**Check the panel's current status:**
```bash
pm2 status
```

**Port 3000 not reachable:**
```bash
sudo ufw allow 3000/tcp
sudo ufw status
```

**Panel did not survive a VPS reboot:**
```bash
pm2 startup
# Run the command it prints, then:
pm2 save
```

**Re-run setup after a code update:**
```bash
ssh connect@hk.meowlix.in -p 2228
sudo bash /home/connect/nighthost/setup.sh
```

**Reset the admin password** (run on the VPS):
```bash
cd /home/connect/nighthost/backend
node -e "
const db = require('better-sqlite3')('nighthost.db');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('newpassword', 10);
db.prepare(\"UPDATE users SET password = ? WHERE username = 'admin'\").run(hash);
console.log('Password updated');
"
```
