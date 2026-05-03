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

// Configuration
const owners = ['94722418022@s.whatsapp.net', '94722969393@s.whatsapp.net'];
const badwords = ['badword1', 'badword2']; // Add more bad words here

function decodeJid(jid) {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return decode.user && decode.server && decode.user + '@' + decode.server || jid;
    } else return jid;
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true,
        getMessage: async (key) => {
            return { conversation: 'hello' };
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot connected successfully!');
            const botNumber = decodeJid(sock.user.id);
            await sock.sendMessage(botNumber, { 
                text: 'bot connect sucsessfull\n\n> Mr_Gamiya' 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const type = Object.keys(msg.message)[0];
        const content = type === 'conversation' ? msg.message.conversation : 
                        type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : 
                        type === 'imageMessage' ? msg.message.imageMessage.caption : 
                        type === 'videoMessage' ? msg.message.videoMessage.caption : '';
        
        const sender = isGroup ? decodeJid(msg.key.participant) : decodeJid(from);
        const isOwner = owners.includes(sender);

        // Anti-Badword System
        if (isGroup && content) {
            const containsBadword = badwords.some(word => content.toLowerCase().includes(word.toLowerCase()));
            if (containsBadword) {
                try {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.sendMessage(from, { text: 'badwords are not allowd' }, { quoted: msg });
                } catch (e) {
                    console.error('Error in anti-badword:', e);
                }
                return; // Stop processing further for this message
            }
        }

        // Status Auto-Reaction
        if (from === 'status@broadcast') {
            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, {
                        react: { text: '🐣', key: msg.key }
                    }, { statusJidList: [msg.key.participant] });
                } catch (e) {
                    console.error('Error reacting to status:', e);
                }
            }, 5000);
        }

        // Command Parser
        const prefix = '.';
        const isCmd = content.startsWith(prefix);
        const command = isCmd ? content.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = content.trim().split(' ').slice(1);

        if (isCmd) {
            switch (command) {
                case 'ping':
                    await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
                    break;

                case 'help':
                    const helpText = `*WA BOT COMMANDS*

*Owner Commands:*
.add <number> - Add participant
.remove <number> - Remove participant
.promote <number> - Promote to admin
.demote <number> - Demote from admin

*Public Commands:*
.ping - Check bot speed
.help - Show this list

> Mr_Gamiya`;
                    await sock.sendMessage(from, { text: helpText }, { quoted: msg });
                    break;

                // Owner Commands
                case 'add':
                    if (!isOwner) return;
                    if (!isGroup) return sock.sendMessage(from, { text: 'This command can only be used in groups.' });
                    if (!args[0]) return sock.sendMessage(from, { text: 'Please provide a number.' });
                    try {
                        const jid = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                        await sock.groupParticipantsUpdate(from, [jid], 'add');
                        await sock.sendMessage(from, { text: `Added ${args[0]}` });
                    } catch (e) {
                        await sock.sendMessage(from, { text: 'Error adding participant.' });
                    }
                    break;

                case 'remove':
                    if (!isOwner) return;
                    if (!isGroup) return sock.sendMessage(from, { text: 'This command can only be used in groups.' });
                    if (!args[0] && !msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                        return sock.sendMessage(from, { text: 'Please tag or provide a number.' });
                    }
                    try {
                        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'];
                        await sock.groupParticipantsUpdate(from, users, 'remove');
                        await sock.sendMessage(from, { text: 'Removed successfully.' });
                    } catch (e) {
                        await sock.sendMessage(from, { text: 'Error removing participant.' });
                    }
                    break;

                case 'promote':
                    if (!isOwner) return;
                    if (!isGroup) return sock.sendMessage(from, { text: 'This command can only be used in groups.' });
                    if (!args[0] && !msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                        return sock.sendMessage(from, { text: 'Please tag or provide a number.' });
                    }
                    try {
                        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'];
                        await sock.groupParticipantsUpdate(from, users, 'promote');
                        await sock.sendMessage(from, { text: 'Promoted to admin.' });
                    } catch (e) {
                        await sock.sendMessage(from, { text: 'Error promoting participant.' });
                    }
                    break;

                case 'demote':
                    if (!isOwner) return;
                    if (!isGroup) return sock.sendMessage(from, { text: 'This command can only be used in groups.' });
                    if (!args[0] && !msg.message.extendedTextMessage?.contextInfo?.mentionedJid) {
                        return sock.sendMessage(from, { text: 'Please tag or provide a number.' });
                    }
                    try {
                        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'];
                        await sock.groupParticipantsUpdate(from, users, 'demote');
                        await sock.sendMessage(from, { text: 'Demoted from admin.' });
                    } catch (e) {
                        await sock.sendMessage(from, { text: 'Error demoting participant.' });
                    }
                    break;
            }
        }
    });
}

startBot();
