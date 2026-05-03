# WhatsApp Bot (Baileys)

Simple WhatsApp bot that auto-reacts to statuses and has basic commands.

## Features
- Auto-react `🐣` to statuses (5-10 seconds delay).
- `.ping` command to check if the bot is alive.
- Session persistence (no need to scan QR code every time).

## Local Setup (Windows/Mac/Linux)

1. **Install Node.js:**
   Download and install from [nodejs.org](https://nodejs.org/). (Recommended: LTS version).

2. **Clone/Download the project:**
   Extract the files into a folder.

3. **Install Dependencies:**
   Open your terminal/command prompt in the project folder and run:
   ```bash
   npm install
   ```

4. **Run the Bot:**
   ```bash
   node index.js
   ```

5. **Scan QR Code:**
   Open WhatsApp on your phone -> Linked Devices -> Link a Device and scan the QR code shown in the terminal.

---

## VPS Deployment (Ubuntu/Debian)

### 1. Update and Install Node.js
Run these commands in your VPS terminal:
```bash
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Check version
node -v
```

### 2. Setup the Bot
1. Upload your files to the VPS (except `node_modules`).
2. Navigate to the folder:
   ```bash
   cd path/to/your/folder
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### 3. Keep the Bot Running 24/7 (Using PM2)
PM2 ensures the bot stays online even if you close the terminal.
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the bot
pm2 start index.js --name "whatsapp-bot"

# Set PM2 to start on system reboot
pm2 startup
pm2 save
```

### 4. Other Useful PM2 Commands
- `pm2 logs` - See real-time logs (errors/messages).
- `pm2 status` - See if the bot is running.
- `pm2 restart whatsapp-bot` - Restart the bot.
- `pm2 stop whatsapp-bot` - Stop the bot.

---

## Notes
- To change the reaction emoji, edit `index.js` line 67.
- Make sure your VPS has a stable internet connection.
- If you want to log in again, delete the `auth_info` folder and restart the bot.
