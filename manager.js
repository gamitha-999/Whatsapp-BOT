const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

// New multi-instance management system
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

let config = {};
let owners = [];
let badwords = [];

function loadConfig(){
    try{
        config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
        owners = config.owners || [];
        badwords = config.badwords || [];
    }catch(e){ console.error('Failed to load config:', e); config = {}; }
}
loadConfig();

function loadSessions(){
    try{
        if(!fs.existsSync(SESSIONS_FILE)) return [];
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) || [];
    }catch(e){ console.error('Failed to load sessions:', e); return []; }
}

function saveSessions(sessions){
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function findSessionByNumber(number){
    const sessions = loadSessions();
    return sessions.find(s => s.number === number);
}

function addSession(number, authFolder){
    const sessions = loadSessions();
    if(sessions.find(s=>s.number===number)) throw new Error('This number is already registered in this bot.');
    sessions.push({ number, authFolder, createdAt: new Date().toISOString() });
    saveSessions(sessions);
}

function removeSession(number){
    let sessions = loadSessions();
    const idx = sessions.findIndex(s=>s.number===number);
    if(idx === -1) throw new Error('Session not found');
    const [removed] = sessions.splice(idx,1);
    saveSessions(sessions);
    // remove auth folder
    try{ fs.rmSync(removed.authFolder, { recursive: true, force: true }); }catch(e){/*ignore*/}
    // stop running bot if exists
    if(bots.has(removed.number)){
        try{ bots.get(removed.number).ws.close(); }catch(e){}
        bots.delete(removed.number);
    }
}

function listSessions(){
    return loadSessions().map(s=>s.number);
}

const bots = new Map(); // number -> sock
const pairingRequests = new Set(); // numbers being paired

async function startBotForSession(session){
    // session: {number, authFolder}
    try{
        const { state, saveCreds } = await useMultiFileAuthState(session.authFolder);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({ version, logger: P({ level: 'silent' }), auth: state, printQRInTerminal: false });

        sock.ev.on('connection.update', (update)=>{
            const { connection, lastDisconnect } = update;
            if(connection === 'open'){
                console.log(`Session ${session.number} connected`);
            }
            if(connection === 'close'){
                const shouldReconnect = !(lastDisconnect?.error && lastDisconnect.error.output?.statusCode === DisconnectReason.loggedOut);
                console.log(`Session ${session.number} closed. Reconnect: ${shouldReconnect}`);
                if(shouldReconnect) startBotForSession(session);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m)=>{
            const msg = m.messages && m.messages[0];
            if(!msg || !msg.message || msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            const type = Object.keys(msg.message)[0];
            const content = (type === 'conversation' ? msg.message.conversation : (type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : '')) || '';
            const sender = from.endsWith('@g.us') ? decodeJid(msg.key.participant) : decodeJid(from);
            const isOwner = owners.includes(sender);

            if(content.startsWith('.')){
                const args = content.trim().split(/\s+/);
                const cmd = args[0].slice(1).toLowerCase();
                if(isOwner){
                    if(cmd === 'sessions' || cmd === 'list_logins'){
                        const list = listSessions();
                        await sock.sendMessage(from, { text: 'Logged-in numbers:\n' + (list.length? list.join('\n') : 'None') }, { quoted: msg });
                    }else if(cmd === 'remove_session' && args[1]){
                        const num = args[1].replace(/[^0-9]/g,'');
                        try{
                            removeSession(num + '@s.whatsapp.net');
                            await sock.sendMessage(from, { text: `Removed session ${num}` }, { quoted: msg });
                        }catch(e){ await sock.sendMessage(from, { text: `Remove failed: ${e.message}` }, { quoted: msg }); }
                    }
                }
            }
        });

        bots.set(session.number, sock);
    }catch(e){ console.error('startBotForSession error', e); }
}

function startAllSavedSessions(){
    const sessions = loadSessions();
    for(const s of sessions){
        startBotForSession(s);
    }
}

async function initiatePairing(targetNumber){
    // targetNumber: string like '947...' or null for any
    const tmpAuth = `auth_pair_${Date.now()}`;
    if(targetNumber && findSessionByNumber(targetNumber + '@s.whatsapp.net')){
        throw new Error('This number is already registered in this bot.');
    }
    if(targetNumber && pairingRequests.has(targetNumber)) throw new Error('Pairing already in progress for this number');
    if(targetNumber) pairingRequests.add(targetNumber);

    console.log('Starting temporary socket for pairing. Scan QR in terminal.');
    const { state, saveCreds } = await useMultiFileAuthState(tmpAuth);
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, logger: P({ level: 'silent' }), auth: state, printQRInTerminal: true });

    return new Promise((resolve, reject)=>{
        const onUpdate = async (update)=>{
            if(update.qr){
                console.log('Scan the QR above to link the number.');
                qrcode.generate(update.qr, { small: true });
            }
            if(update.connection === 'open'){
                try{
                    const num = decodeJid(sock.user.id);
                    const normalized = num.includes('@')? num : (num + '@s.whatsapp.net');
                    const authFolder = `auth_${normalized.replace(/[@:]/g,'_')}`;
                    // move tmpAuth -> authFolder
                    try{ fs.renameSync(tmpAuth, authFolder); }catch(e){ console.warn('Could not rename auth folder:', e); }
                    // save session
                    try{ addSession(normalized, authFolder); }catch(e){ console.error('Add session error', e); }
                    sock.ev.off('connection.update', onUpdate);
                    try{ sock.ws.close(); }catch(e){}
                    pairingRequests.delete(targetNumber);
                    resolve({ number: normalized, authFolder });
                }catch(e){ reject(e); }
            }
            if(update.connection === 'close' && update.lastDisconnect){
                // if disconnected before open
            }
        };
        sock.ev.on('connection.update', onUpdate);
        sock.ev.on('creds.update', saveCreds);
        // safety timeout 2 minutes
        setTimeout(()=>{
            try{ sock.ws.close(); }catch(e){}
            pairingRequests.delete(targetNumber);
            reject(new Error('Pairing timed out'));
        }, 2*60*1000);
    });
}

// Console (stdin) commands
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data)=>{
    const text = data.toString().trim();
    if(!text) return;
    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    try{
        if(cmd === 'start' && parts[1] === 'bot'){
            console.log('Starting all saved sessions...');
            startAllSavedSessions();
        }else if(cmd === 'qr'){
            // show qr by initiating pairing for temp
            console.log('Generating QR for first-time linking...');
            const res = await initiatePairing(null).catch(e=>{ console.error('Pairing failed:', e.message); });
            if(res) console.log('Paired:', res.number);
        }else if(cmd === 'code' && parts[1]){
            const number = parts[1].replace(/[^0-9]/g,'');
            console.log('Generating Pair Code (QR) for', number);
            const res = await initiatePairing(number).catch(e=>{ console.error('Pairing failed:', e.message); });
            if(res) console.log('Paired:', res.number);
        }else if(cmd === 'list'){
            console.log('Saved sessions:', listSessions());
        }else{
            console.log('Unknown command. Supported: "start bot", "qr", "code <number>", "list"');
        }
    }catch(e){ console.error('Command error:', e); }
});

// On first boot, if no sessions exist, auto start pairing once
const existing = loadSessions();
if(existing.length === 0){
    console.log('No saved sessions found — generating Pair QR for initial link.');
    initiatePairing(null).then(r=>{
        console.log('Initial pairing complete:', r?.number);
        // start all after pairing
        startAllSavedSessions();
    }).catch(e=>{
        console.error('Initial pairing error:', e.message);
    });
}else{
    // start saved
    startAllSavedSessions();
}

// Exported helpers if needed
module.exports = { startAllSavedSessions, initiatePairing, listSessions, removeSession };