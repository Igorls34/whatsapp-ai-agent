import fs from 'node:fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';

function extractInfo(msg) {
  if (!msg.message) return { text: null, type: null };
  const type = Object.keys(msg.message)[0];
  if (type === 'conversation') return { text: msg.message.conversation, type: 'text' };
  if (type === 'extendedTextMessage') return { text: msg.message.extendedTextMessage.text, type: 'text' };
  if (type === 'imageMessage') return { text: msg.message.imageMessage.caption || null, type: 'image' };
  if (type === 'videoMessage') return { text: null, type: 'video' };
  if (type === 'audioMessage') return { text: null, type: 'audio' };
  if (type === 'stickerMessage') return { text: null, type: 'sticker' };
  if (type === 'documentMessage') return { text: null, type: 'document' };
  return { text: null, type: 'unsupported' };
}

// WhatsApp passou a rotear mensagens por LID (ex: 179641335693490:82@lid).
// Baileys emite o mapa lid -> jid de telefone em contacts.upsert; mantemos em memória.
const lidToPhone = new Map();

// "179641335693490:82@lid" -> "179641335693490@lid"
function jidSemDispositivo(lid) {
  const idx = lid.indexOf(':');
  return idx === -1 ? lid : `${lid.slice(0, idx)}@lid`;
}

export async function connectWhatsApp({ onMessage, onSocket }) {
  fs.mkdirSync(config.waSessionDir, { recursive: true });

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(config.waSessionDir);

  const socket = makeWASocket({
    version,
    auth: state,
  });

  // Avisa sempre que um socket novo entra (conexão inicial ou reconexão)
  if (typeof onSocket === 'function') onSocket(socket);

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('contacts.upsert', (contacts) => {
    for (const c of contacts || []) {
      if (c.lid && (c.jid || c.id)) {
        lidToPhone.set(jidSemDispositivo(c.lid), c.jid || c.id);
      }
    }
  });

  socket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nEscaneie o QR Code abaixo com o WhatsApp do Igor:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('[whatsapp] Conectado e pronto para atender 24/7.');
    }

    if (connection === 'close') {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      if (loggedOut) {
        console.log('[whatsapp] Sessão encerrada (logout). Rode de novo para escanear o QR.');
        process.exit(1);
      }
      console.log('[whatsapp] Conexão caiu. Reconectando em 3s...');
      setTimeout(() => connectWhatsApp({ onMessage }), 3000);
    }
  });

  // Fluxo principal: cada mensagem recebida é roteada para o handler (RAG + LLM + resposta).
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key?.remoteJid;
      if (!jid) continue;
      const isLid = jid.endsWith('@lid');
      if (!isLid && !jid.endsWith('@s.whatsapp.net')) continue;

      const { text, type } = extractInfo(msg);
      if (type === 'text' && !text) continue;

      // Resolve o telefone real do cliente (LID é anônimo; usamos o mapa de contatos).
      const telefone = isLid
        ? (() => {
            const phoneJid = lidToPhone.get(jidSemDispositivo(jid)) || msg.key?.senderPn || jid;
            return phoneJid.replace('@s.whatsapp.net', '').replace('@lid', '');
          })()
        : jid.replace('@s.whatsapp.net', '');

      try {
        await onMessage({
          remoteJid: jid,
          telefone,
          pushName: msg.pushName || null,
          text,
          type,
        });
      } catch (err) {
        console.error('[handler] erro ao processar mensagem:', err);
      }
    }
  });

  return socket;
}