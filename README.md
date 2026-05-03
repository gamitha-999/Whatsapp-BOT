# WhatsApp Multi-Account Bot - Mr_Gamiya

A powerful WhatsApp bot built with `@whiskeysockets/baileys` that supports multiple accounts simultaneously using pairing codes.

---

## 🚀 Features

- **Multi-Account Support:** Link and run multiple WhatsApp accounts at the same time.
- **Pairing Code Login:** No need to scan QR codes; use the pairing code for easy linking.
- **Auto Status View & React:** Automatically view status updates and react with a custom emoji.
- **Anti-Badword System:** Automatically deletes messages containing prohibited words in groups (requires Bot Admin).
- **Group Management:** Easily promote or demote members via chat commands.
- **CLI Interface:** Built-in terminal interface for managing sessions.

---

## 🛠 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/gamitha-999/Whatsapp-BOT.git
cd Whatsapp-BOT
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Bot
```bash
npm start
```

---

## 💻 CLI Commands

When you run the bot, you can use the following commands in the terminal:

- `code <number>` - Link a new account using a pairing code. (Example: `code 947xxxxxxxx`)
- `start` - Start all linked bot sessions.
- `list` - List all currently linked phone numbers.
- `unlink <number>` - Remove a linked account and delete its session data.
- `clear` - Clear the terminal and show the welcome screen.

---

## 💬 In-Chat Commands

These commands can be used within WhatsApp:

- `/ping` - Check if the bot is active.
- `/help` - Show the help menu.
- `/sessions` - (Owner only) List all linked sessions.
- `/promote` - (Owner & Group only) Promote a user to admin (tag or reply).
- `/demote` - (Owner & Group only) Demote an admin (tag or reply).

---

## ⚙️ Configuration

You can customize the bot by editing the configuration section in `index.js`:

```javascript
const OWNERS = ["94722418022@s.whatsapp.net", "94722969393@s.whatsapp.net"];
const BAD_WORDS = ['fuck', 'sex', 'porn', 'xxx', 'hutto', 'pako', 'ponnaya'];
const CONFIG = {
    autoViewStatus: true,
    autoReactStatus: true,
    statusEmoji: '👻'
};
```

---

## ⚠️ Requirements

- Node.js 20.x or higher
- A stable internet connection

> Created with ❤️ by [Mr_Gamiya](https://github.com/gamitha-999)
