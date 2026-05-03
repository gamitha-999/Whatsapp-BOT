# WhatsApp Bot Mr_Gamiya

Simple WhatsApp bot with group management, anti-badword system, and auto-reaction.

## Features
- **Auto-Reaction:** Reacts `🐣` to statuses (5 seconds delay).
- **Connection Alert:** Sends a success message when connected.
- **Group Management:** Owner-only commands to manage group participants.
- **Anti-Badword:** Automatically deletes messages containing bad words and warns the user.
- **Session Persistence:** Remembers your login so you don't scan every time.

## Commands

### Public Commands
- `.ping` - Check if the bot is alive.
- `.help` - Show all available commands.

### Owner Commands
- `.add <number>` - Add a person to the group (e.g., `.add 94722xxxxxx`).
- `.remove <tag/number>` - Remove a person from the group.
- `.promote <tag/number>` - Make a person an admin.
- `.demote <tag/number>` - Remove admin rights from a person.

---

## Installation & Setup

### 1. Requirements
- **Node.js:** v18 or higher
- **Git:** To clone the repository

### 2. Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/gamitha-999/Whatsapp-BOT.git
   cd Whatsapp-BOT
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the bot:
   ```bash
   node index.js
   ```

---

## VPS Deployment (Ubuntu/Debian)

### 1. System Update & Node.js Installation
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

### 2. Project Setup
```bash
git clone https://github.com/gamitha-999/Whatsapp-BOT.git
cd Whatsapp-BOT
npm install
```

### 3. Run 24/7 with PM2
```bash
sudo npm install -g pm2
pm2 start index.js --name "wa-bot"
pm2 save
pm2 startup
```

---

## Configuration
Open `index.js` to modify:
- `owners`: Add your WhatsApp numbers (with country code).
- `badwords`: Add words you want to block in groups.

> Created by Mr_Gamiya
