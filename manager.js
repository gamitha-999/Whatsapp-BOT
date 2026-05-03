const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- Configuration & Session Management ---
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');

let config = {
    owners: [],
    badwords: [],
    autoViewStatus: true,
    autoReactStatus: true,
    statusEmoji: '👻'
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config = { ...config, ...data };
        }
    } catch (e) {
        console.error('Failed to load config:', e);
    }
}
loadConfig();

function loadSessions() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || [];
    } catch (e) {
        console.error('Failed to load sessions:', e);
        return [];
    }
}

function saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function addSession(number, authFolder) {
    const sessions = loadSessions();
    if (sessions.find(s => s.number === number)) return; // Already exists
    sessions.push({ number, authFolder, createdAt: new Date().toISOString() });
    saveSessions(sessions);
}

function removeSession(number) {
    let sessions = loadSessions();
    const idx = sessions.findIndex(s => s.number === number);
    
    // Even if not in sessions.json, try to close and delete from bots map
    if (bots.has(number)) {
        try { bots.get(number).ws.close(); } catch (e) { }
        bots.delete(number);
    }

    if (idx === -1) return;
    const [removed] = sessions.splice(idx, 1);
    saveSessions(sessions);
    try { 
        if (fs.existsSync(removed.authFolder)) {
            fs.rmSync(removed.authFolder, { recursive: true, force: true }); 
        }
    } catch (e) { console.error(`[Cleanup] Error deleting folder:`, e.message); }
}

function decodeJid(jid) {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
}

// --- Bot Logic (Shared for all instances) ---
const bots = new Map();

async function handleMessages(sock, m) {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const botNumber = decodeJid(sock.user.id);
    const sender = msg.key.fromMe ? botNumber : (from.endsWith('@g.us') ? decodeJid(msg.key.participant) : decodeJid(from));

    // --- Status Handler ---
    if (from === 'status@broadcast') {
        if (config.autoViewStatus) {
            try {
                if (msg.key.participant && decodeJid(msg.key.participant) === botNumber) return;
                await sock.readMessages([msg.key]);
                console.log(`[Status] Viewed status from: ${msg.key.participant || msg.key.remoteJid}`);
                
                if (config.autoReactStatus) {
                    await delay(2000);
                    const participant = msg.key.participant || msg.key.remoteJid;
                    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    await sock.sendMessage('status@broadcast', {
                        react: { text: config.statusEmoji || '👻', key: msg.key }
                    }, { statusJidList: [participant, myJid] });
                }
            } catch (e) { console.error('[Status] Error:', e.message); }
        }
        return;
    }

    const type = Object.keys(msg.message)[0];
    if (type === 'protocolMessage') return;

    const content = (type === 'conversation' ? msg.message.conversation : 
                    type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : '') || '';
    const isGroup = from.endsWith('@g.us');
    const isOwner = config.owners.includes(sender) || sender === botNumber;

    if (content.startsWith('/')) {
        const args = content.trim().split(/\s+/);
        const command = args[0].slice(1).toLowerCase();

        switch (command) {
            case 'ping':
                await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
                break;
            case 'command':
            case 'help':
                const helpText = `☄️ *Mr_Gamiya Bot Commands* ☄️
__________________________

*Public Commands:*
💠 /ping - Check bot speed
💠 /command - Show this list

*Owner/Admin Commands:*
💠 /sessions - List logged accounts
💠 /add <number> - Add participant
💠 /remove <tag/number> - Remove participant
💠 /promote <tag/number> - Promote to admin
💠 /demote <tag/number> - Demote from admin
__________________________
   >  Powered by Mr_Gamiya`;
                await sock.sendMessage(from, { text: helpText }, { quoted: msg });
                break;
            case 'sessions':
                if (!isOwner) return;
                const list = loadSessions().map(s => s.number).join('\n') || 'None';
                await sock.sendMessage(from, { text: `*Linked Sessions:*\n${list}` }, { quoted: msg });
                break;
            case 'add':
                if (!isGroup) return;
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const isBotAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === botNumber)?.admin != null;
                    const isSenderAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === sender)?.admin != null || isOwner;

                    if (!isSenderAdmin) return sock.sendMessage(from, { text: 'This command is only for admins.' });
                    if (!isBotAdmin) return sock.sendMessage(from, { text: 'Bot must be an admin to add members.' });

                    if (!args[1]) return sock.sendMessage(from, { text: 'Please provide a number.' });
                    const jid = args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                    await sock.groupParticipantsUpdate(from, [jid], 'add');
                    await sock.sendMessage(from, { text: `Added ${args[1]} ✅` });
                } catch (e) { await sock.sendMessage(from, { text: 'Error adding participant.' }); }
                break;
            case 'remove':
                if (!isGroup) return;
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const isBotAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === botNumber)?.admin != null;
                    const isSenderAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === sender)?.admin != null || isOwner;

                    if (!isSenderAdmin) return sock.sendMessage(from, { text: 'This command is only for admins.' });
                    if (!isBotAdmin) return sock.sendMessage(from, { text: 'Bot must be an admin to remove members.' });

                    let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (quotedParticipant) users.push(quotedParticipant);
                    if (args[1] && !users.length) users.push(args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    
                    if (!users.length) return sock.sendMessage(from, { text: 'Please tag a user, reply to a message, or provide a number.' });
                    
                    await sock.groupParticipantsUpdate(from, users, 'remove');
                    await sock.sendMessage(from, { text: 'Removed successfully. ✅' });
                } catch (e) { await sock.sendMessage(from, { text: 'Error removing participant.' }); }
                break;
            case 'promote':
                if (!isGroup) return;
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const isBotAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === botNumber)?.admin != null;
                    const isSenderAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === sender)?.admin != null || isOwner;

                    if (!isSenderAdmin) return sock.sendMessage(from, { text: 'This command is only for admins.' });
                    if (!isBotAdmin) return sock.sendMessage(from, { text: 'Bot must be an admin to promote members.' });

                    let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (quotedParticipant) users.push(quotedParticipant);
                    if (args[1] && !users.length) users.push(args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net');

                    if (!users.length) return sock.sendMessage(from, { text: 'Please tag a user, reply to a message, or provide a number.' });

                    await sock.groupParticipantsUpdate(from, users, 'promote');
                    await sock.sendMessage(from, { text: 'Promoted to admin. ✅' });
                } catch (e) { await sock.sendMessage(from, { text: 'Error promoting: ' + e.message }); }
                break;
            case 'demote':
                if (!isGroup) return;
                try {
                    const groupMetadata = await sock.groupMetadata(from);
                    const isBotAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === botNumber)?.admin != null;
                    const isSenderAdmin = groupMetadata.participants.find(p => decodeJid(p.id) === sender)?.admin != null || isOwner;

                    if (!isSenderAdmin) return sock.sendMessage(from, { text: 'This command is only for admins.' });
                    if (!isBotAdmin) return sock.sendMessage(from, { text: 'Bot must be an admin to demote members.' });

                    let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (quotedParticipant) users.push(quotedParticipant);
                    if (args[1] && !users.length) users.push(args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net');

                    if (!users.length) return sock.sendMessage(from, { text: 'Please tag a user, reply to a message, or provide a number.' });

                    await sock.groupParticipantsUpdate(from, users, 'demote');
                    await sock.sendMessage(from, { text: 'Demoted from admin. ✅' });
                } catch (e) { await sock.sendMessage(from, { text: 'Error demoting participant.' }); }
                break;
        }
    }
}

async function startBotForSession(session) {
    const { state, saveCreds } = await useMultiFileAuthState(session.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        markOnline: false,
        browser: ["Gamiya Bot", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log(`[Bot] ${session.number} connected successfully!`);
            
            const botNumber = decodeJid(sock.user.id);
            const aliveMsg = `☄️ *Mr_Gamiya Bot* ☄️
__________________________
  
  💠 *Status:* I'm Alive! 🟢
  💠 *Platform:* Multi-Device
  💠 *Prefix:* [ / ]
__________________________
   >  Powered by Mr_Gamiya`;

            await sock.sendMessage(botNumber, { text: aliveMsg });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBotForSession(session);
        }
    });

    sock.ev.on('messages.upsert', (m) => handleMessages(sock, m));
    bots.set(session.number, sock);
}

// --- Pairing Logic ---
async function initiatePairing(phoneNumber, isRetry = false) {
    // Normalize number
    let number = phoneNumber.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) {
        number = '94' + number.slice(1);
    }
    const fullJid = number + '@s.whatsapp.net';
    
    // Prevent multiple pairing attempts for the same number
    if (bots.has(fullJid) && !isRetry) {
        console.log(`[Pairing] Session for ${number} is already active.`);
        return;
    }

    const authFolder = `auth_info_${number}`;
    
    // Only delete folder on the first attempt, NOT on automatic retries
    if (!isRetry) {
        try {
            if (fs.existsSync(authFolder)) {
                console.log(`[Pairing] Cleaning up old data for a fresh start...`);
                fs.rmSync(authFolder, { recursive: true, force: true });
            }
        } catch (e) {}
    }

    if (!isRetry) console.log(`\n[Pairing] Initializing pairing for: ${number}...`);
    
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ["Windows", "Chrome", "121.0.6167.140"]
    });

    let isLinked = false;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection) {
            console.log(`[Pairing Update] Status: ${connection}`);
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 'Unknown';
            console.log(`[Pairing Update] Closed. Reason: ${reason}`);
            
            // Reconnect if not linked and not logged out
            if (!isLinked && reason !== DisconnectReason.loggedOut) {
                console.log(`[Pairing Update] Re-connecting...`);
                setTimeout(() => initiatePairing(number, true), 3000);
            }
        }

        if (connection === 'open') {
            isLinked = true;
            const connectedJid = decodeJid(sock.user.id);
            addSession(connectedJid, authFolder);
            console.log(`\n[Pairing] Successfully linked: ${connectedJid} ✅`);
            
            // Mark it in the bots map.
            bots.set(connectedJid, sock);

            console.log(`Link another? type: code <number>`);
            console.log(`Start the bot? type: start`);
            if (rl) rl.prompt();
        }
    });

    if (!sock.authState.creds.registered) {
        try {
            // Only wait if it's the first attempt
            if (!isRetry) {
                console.log(`[Pairing] Waiting 15 seconds for stability...`);
                await delay(15000);
            }
            if (isLinked) return;
            const code = await sock.requestPairingCode(number);
            console.log(`\n-----------------------------------------`);
            console.log(`YOUR PAIRING CODE: ${code}`);
            console.log(`-----------------------------------------\n`);
            console.log(`Open WhatsApp > Linked Devices > Link with phone number instead.`);
        } catch (e) {
            console.error('[Pairing] Error:', e.message);
        }
    }
}

// --- CLI Interface ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'BOT> '
});

function showWelcome() {
    console.clear();
    console.log(`
=========================================
      WHATSAPP BOT MULTI-ACCOUNT
=========================================
1. To link an account:
   Type: code <mobile number>
   (Example: code 0771234567)

2. To start all linked bots:
   Type: start

3. To list linked accounts:
   Type: list

4. To unlink an account (delete all data):
   Type: unlink <mobile number>
   (Example: unlink 0771234567)

QR code login is DISABLED.
=========================================
    `);
    rl.prompt();
}

rl.on('line', (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
        case 'code':
            if (!parts[1]) {
                console.log('Please provide a phone number. Example: code 0771234567');
            } else {
                initiatePairing(parts[1]);
            }
            break;
        case 'start':
            const sessions = loadSessions();
            if (sessions.length === 0) {
                console.log('No accounts linked. Please link an account first using: code <number>');
            } else {
                console.log(`Starting ${sessions.length} bots...`);
                sessions.forEach(startBotForSession);
            }
            break;
        case 'list':
            const list = loadSessions().map(s => s.number);
            console.log('Linked accounts:', list.length ? list : 'None');
            break;
        case 'unlink':
            if (!parts[1]) {
                console.log('Please provide the number to unlink. Example: unlink 0771234567');
            } else {
                let numToUnlink = parts[1].replace(/[^0-9]/g, '');
                if (numToUnlink.startsWith('0')) {
                    numToUnlink = '94' + numToUnlink.slice(1);
                }
                if (!numToUnlink.includes('@')) numToUnlink += '@s.whatsapp.net';
                
                try {
                    console.log(`Unlinking and deleting data for ${numToUnlink}...`);
                    removeSession(numToUnlink);
                    console.log(`Successfully unlinked and deleted all data for ${numToUnlink} ✅`);
                } catch (e) {
                    console.error(`Error unlinking session:`, e.message);
                }
            }
            break;
        case 'clear':
            console.clear();
            showWelcome();
            break;
        default:
            console.log('Unknown command. Use: code <number>, start, list, clear');
    }
    rl.prompt();
});

// Show welcome menu on startup - sessions only start when user types 'start'
showWelcome();
