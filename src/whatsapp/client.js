import fs from 'node:fs';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import { config } from '../config.js';

// Chama um callback opcional sem deixar um erro dele derrubar a conexão.
function avisar(callback, valor) {
  if (typeof callback !== 'function') return;
  try {
    callback(valor);
  } catch (err) {
    console.error('[whatsapp] callback falhou:', err.message);
  }
}

// Desenha uma caixa de aviso com largura uniforme no terminal.
function boxAviso(linhas) {
  const largura = Math.max(...linhas.map((l) => l.length));
  console.log('┌' + '─'.repeat(largura) + '┐');
  for (const linha of linhas) {
    console.log('│ ' + linha.padEnd(largura) + ' │');
  }
  console.log('└' + '─'.repeat(largura) + '┘');
}

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

// Conexão com o WhatsApp (Baileys).
//
// Callbacks:
//   onMessage({ remoteJid, telefone, pushName, text, type })
//   onSocket(socket)        → sempre que um socket novo entra (conexão/reconexão)
//   onQr(qr | null)         → QR novo para pareamento (null = QR resolvido)
//   onStatus('open' | 'close' | 'loggedOut')
export async function connectWhatsApp({ onMessage, onSocket, onQr, onStatus } = {}) {
  const opcoes = { onMessage, onSocket, onQr, onStatus };
  fs.mkdirSync(config.waSessionDir, { recursive: true });

  const { version } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState(config.waSessionDir);

  const socket = makeWASocket({
    version,
    auth: state,
  });

  // Avisa sempre que um socket novo entra (conexão inicial ou reconexão)
  avisar(onSocket, socket);

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
      boxAviso([
        '⚠ ⚠ ⚠  PRIVADO  ⚠ ⚠ ⚠',
        'Este QR é pessoal e intransferível.',
        'Não rastreie, não compartilhe e não exponha o QR.',
        'Quem escanear terá acesso total ao seu WhatsApp.',
        'Escaneie apenas você, no seu próprio aparelho.',
      ]);
      console.log('');
      console.log('Também disponível em: /qr (mesma porta do app)\n');
      qrcode.generate(qr, { small: true });
      console.log('');
      avisar(onQr, qr);
    }

    if (connection === 'open') {
      console.log('[whatsapp] Conectado e pronto para atender 24/7.');
      avisar(onQr, null);
      avisar(onStatus, 'open');
    }

    if (connection === 'close') {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      avisar(onStatus, loggedOut ? 'loggedOut' : 'close');
      if (loggedOut) {
        console.log('[whatsapp] Sessão encerrada (logout). Rode de novo para escanear o QR.');
        process.exit(1);
      }
      console.log('[whatsapp] Conexão caiu. Reconectando em 3s...');
      // Reconecta com os MESMOS callbacks (antes o onSocket/onQr se perdia aqui).
      setTimeout(() => connectWhatsApp(opcoes), 3000);
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