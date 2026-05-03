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

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        getMessage: async (key) => {
            return { conversation: 'hello' };
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('Scan the QR code below:');
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('Bot connected successfully!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const content = type === 'conversation' ? msg.message.conversation : type === 'extendedTextMessage' ? msg.message.extendedTextMessage.text : '';

        // Status Auto-Reaction
        if (from === 'status@broadcast') {
            console.log(`Status detected from: ${msg.key.participant}`);
            // Small delay before reacting
            setTimeout(async () => {
                try {
                    await sock.sendMessage(from, {
                        react: {
                            text: '🐣',
                            key: msg.key
                        }
                    }, { statusJidList: [msg.key.participant] });
                    console.log(`Reacted 🐣 to status from ${msg.key.participant}`);
                } catch (e) {
                    console.error('Error reacting to status:', e);
                }
            }, 5000); // 5 seconds delay
        }

        // Ping Command
        if (content.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: 'Pong!' }, { quoted: msg });
        }
    });
}

startBot();
