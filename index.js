const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode,
    jidNormalizedUser,
    delay
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- Configuration ---
const OWNERS = ["94722418022@s.whatsapp.net", "94722969393@s.whatsapp.net"];
const BAD_WORDS = ['fuck', 'sex', 'porn', 'xxx', 'hutto', 'pako', 'ponnaya'];
const CONFIG = {
    autoViewStatus: true,
    autoReactStatus: true,
    statusEmoji: '👻'
};

const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

function loadSessions() {
    try {
        if (!fs.existsSync(SESSIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || [];
    } catch (e) { return []; }
}

function saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function addSession(number, authFolder) {
    const sessions = loadSessions();
    if (sessions.find(s => s.number === number)) return;
    sessions.push({ number, authFolder, createdAt: new Date().toISOString() });
    saveSessions(sessions);
}

function removeSession(number) {
    let sessions = loadSessions();
    const idx = sessions.findIndex(s => s.number === number);
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
    } catch (e) {}
}

function decodeJid(jid) {
    if (!jid) return jid;
    return jidNormalizedUser(jid);
}

// --- Bot Logic ---
const bots = new Map();
const badWordCounts = new Map(); // Track bad word strikes per user in groups

async function handleMessages(sock, m) {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const botNumber = decodeJid(sock.user.id);
    const sender = from.endsWith('@g.us') ? decodeJid(msg.key.participant) : decodeJid(from);

    const type = Object.keys(msg.message)[0];
    if (type === 'protocolMessage') return;

    // Comprehensive content extraction (text, captions, etc.)
    const content = (
        type === 'conversation' ? msg.message.conversation : 
        type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : 
        type === 'imageMessage' ? msg.message.imageMessage.caption : 
        type === 'videoMessage' ? msg.message.videoMessage.caption : 
        type === 'documentMessage' ? msg.message.documentMessage.caption : 
        ''
    ) || '';

    const isGroup = from.endsWith('@g.us');
    const isOwner = OWNERS.includes(sender) || sender === botNumber;

    // --- Status Handler ---
    if (from === 'status@broadcast') {
        if (CONFIG.autoViewStatus) {
            try {
                await sock.readMessages([msg.key]);
                console.log(`[Status] Viewed status from: ${sender}`);
                
                if (CONFIG.autoReactStatus) {
                    await delay(2000);
                    const myJid = botNumber;
                    await sock.sendMessage('status@broadcast', {
                        react: { text: CONFIG.statusEmoji || '👻', key: msg.key }
                    }, { statusJidList: [sender, myJid] });
                }
            } catch (e) { }
        }
        return;
    }

    // Anti-Badword System
    if (isGroup && content) {
        const lowerContent = content.toLowerCase();
        const containsBadword = BAD_WORDS.some(word => lowerContent.includes(word.toLowerCase()));
        
        if (containsBadword && !isOwner) {
            const warnKey = `${from}_${sender}`;
            const count = (badWordCounts.get(warnKey) || 0) + 1;
            badWordCounts.set(warnKey, count);

            console.log(`[Anti-Badword] Detected: "${content}" from ${sender} (Strike: ${count}/3)`);
            try {
                const groupMetadata = await sock.groupMetadata(from);
                
                // Get all possible bot IDs (Phone Number and LID)
                const myNormalizedId = decodeJid(sock.user.id);
                const myLID = sock.user.lid ? decodeJid(sock.user.lid) : null;
                
                // Find bot in participants using all available info
                const me = groupMetadata.participants.find(p => {
                    const pId = decodeJid(p.id);
                    return pId === myNormalizedId || (myLID && pId === myLID);
                });

                const isBotAdmin = me && (me.admin === 'admin' || me.admin === 'superadmin');
                
                if (isBotAdmin) {
                    await sock.sendMessage(from, { delete: msg.key });

                    if (count >= 3) {
                        await sock.groupParticipantsUpdate(from, [sender], 'remove');
                        await sock.sendMessage(from, { 
                            text: `🚫 @${sender.split('@')[0]} has been removed for using bad words 3 times.`, 
                            mentions: [sender] 
                        });
                        badWordCounts.delete(warnKey);
                    } else {
                        await sock.sendMessage(from, { 
                            text: `⚠️ @${sender.split('@')[0]}, bad words are not allowed!\nWarning: ${count}/3`, 
                            mentions: [sender] 
                        }, { quoted: msg });
                    }
                } else {
                    console.log(`[Anti-Badword] Deletion failed: Bot is not an admin.`);
                }
            } catch (e) {
                console.error('[Anti-Badword] Error:', e.message);
            }
        }
    }

    if (content.startsWith('/')) {
        const args = content.trim().split(/\s+/);
        const command = args[0].slice(1).toLowerCase();

        switch (command) {
            case 'ping':
                await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
                break;
            case 'help':
                const helpText = `☄️ *Mr_Gamiya Bot* ☄️\n__________________________\n\n💠 /ping\n💠 /help\n💠 /sessions\n💠 /promote\n💠 /demote\n__________________________\n> Mr_Gamiya`;
                await sock.sendMessage(from, { text: helpText }, { quoted: msg });
                break;
            case 'sessions':
                if (!isOwner) return;
                const list = loadSessions().map(s => s.number).join('\n') || 'None';
                await sock.sendMessage(from, { text: `*Linked Sessions:*\n${list}` }, { quoted: msg });
                break;
            case 'promote':
                if (!isOwner || !isGroup) return;
                try {
                    let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (quotedParticipant) users.push(quotedParticipant);
                    if (args[1] && !users.length) users.push(args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (users.length) {
                        await sock.groupParticipantsUpdate(from, users, 'promote');
                        await sock.sendMessage(from, { text: 'Promoted to admin. ✅' });
                    }
                } catch (e) { }
                break;
            case 'demote':
                if (!isOwner || !isGroup) return;
                try {
                    let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    const quotedParticipant = msg.message.extendedTextMessage?.contextInfo?.participant;
                    if (quotedParticipant) users.push(quotedParticipant);
                    if (args[1] && !users.length) users.push(args[1].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
                    if (users.length) {
                        await sock.groupParticipantsUpdate(from, users, 'demote');
                        await sock.sendMessage(from, { text: 'Demoted from admin. ✅' });
                    }
                } catch (e) { }
                break;
        }
    }
}

async function startBotForSession(session) {
    if (bots.has(session.number)) return;

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

    bots.set(session.number, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(`[Bot] ${session.number} connected successfully! ✅`);
            const botNumber = decodeJid(sock.user.id);
            await sock.sendMessage(botNumber, { text: `bot connect sucsessfull\n\n> Mr_Gamiya` });
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error ? new Boom(lastDisconnect.error)?.output?.statusCode : 0;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            bots.delete(session.number);
            if (shouldReconnect) {
                setTimeout(() => startBotForSession(session), 5000);
            }
        }
    });

    sock.ev.on('messages.upsert', (m) => handleMessages(sock, m));
}

// --- Pairing Logic ---
async function initiatePairing(phoneNumber) {
    let number = phoneNumber.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '94' + number.slice(1);
    
    const authFolder = `auth_info_${number}`;
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        markOnline: false,
        browser: ["Windows", "Chrome", "121.0.6167.140"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            const connectedJid = decodeJid(sock.user.id);
            addSession(connectedJid, authFolder);
            console.log(`\n[Pairing] Linked: ${connectedJid} ✅`);
            bots.set(connectedJid, sock);
        }
    });

    if (!sock.authState.creds.registered) {
        await delay(5000);
        const code = await sock.requestPairingCode(number);
        console.log(`\nYOUR CODE: ${code}\n`);
    }
}

// --- CLI ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'BOT> ' });

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
            if (parts[1]) initiatePairing(parts[1]);
            break;
        case 'start':
            const sessions = loadSessions();
            if (sessions.length === 0) {
                console.log('No accounts linked.');
            } else {
                console.log(`Starting ${sessions.length} bots...`);
                sessions.forEach(startBotForSession);
            }
            break;
        case 'list':
            console.log('Linked accounts:', loadSessions().map(s => s.number));
            break;
        case 'unlink':
            if (parts[1]) {
                removeSession(parts[1]);
                console.log(`Unlinked ${parts[1]}`);
            }
            break;
        case 'clear':
            showWelcome();
            break;
    }
    rl.prompt();
});

showWelcome();
