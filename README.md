# WhatsApp Bot (Baileys)

Simple WhatsApp bot that auto-reacts to statuses and has basic commands.

## Features
- Auto-react `🐣` to statuses (5-10 seconds delay).
- `.ping` command to check if the bot is alive.
- Session persistence (no need to scan QR code every time).

## Installation & Setup

### 1. Requirements
- **Node.js:** v18 or higher (LTS recommended)
- **Git:** To clone/manage the repository

### 2. Local Setup (Windows/Mac)
1. Install Node.js from [nodejs.org](https://nodejs.org/).
2. Open your terminal and run:
   ```bash
   # Clone the repository
   git clone https://github.com/gamitha-999/Whatsapp-BOT.git
   cd Whatsapp-BOT

   # Install dependencies
   npm install
   ```
3. Run the bot:
   ```bash
   node index.js
   ```
4. Scan the QR code with your WhatsApp.

---

## VPS Deployment (Ubuntu/Debian)

### 1. Install Node.js
Copy and paste these commands into your VPS terminal:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Install Git and Project
```bash
sudo apt-get install -y git
git clone https://github.com/gamitha-999/Whatsapp-BOT.git
cd Whatsapp-BOT
npm install
```

### 3. Keep it Running 24/7 (Using PM2)
```bash
sudo npm install -g pm2
pm2 start index.js --name "wa-bot"
pm2 save
pm2 startup
```

### 4. Useful Commands
- `pm2 logs` - Check real-time logs (to see the QR code if needed)
- `pm2 restart wa-bot` - Restart the bot
- `pm2 stop wa-bot` - Stop the bot

---

## Dependencies (package.json)
The bot uses the following libraries:
- `@whiskeysockets/baileys`: Core WhatsApp API
- `pino`: Logger for Baileys
- `qrcode-terminal`: To display QR code in terminal
- `@hapi/boom`: For error handling

---

## Troubleshooting
- **QR Code not appearing?** Run `node index.js` manually or check `pm2 logs`.
- **Bot not reacting to status?** Ensure your phone is connected to the internet.
- **Permission issues?** Use `sudo` for global npm installs or file modifications.
