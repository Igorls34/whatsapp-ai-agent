import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import { config } from '../config.js';

const qrDir = () => path.join(path.dirname(config.waSessionDir), 'qr');
let qrPopupAberto = false;

// Abre (uma única vez) uma janela que mostra o QR atual e se atualiza sozinha.
function abrirPopupQr() {
  if (qrPopupAberto || process.platform !== 'win32') return;
  qrPopupAberto = true;
  const arquivoHtml = path.join(qrDir(), 'qr.html');
  const gravar = () => {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>WhatsApp — QR Code do Bot</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; flex-direction:column; align-items:center;
           justify-content:center; gap:14px; background:#0a0a0a; color:#fff;
           font-family:'Segoe UI',sans-serif; }
    h2 { font-size:18px; margin:0; text-align:center; color:#8b5cf6; }
    img { width:300px; height:300px; background:#fff; padding:10px; border-radius:12px;
          box-shadow:0 6px 24px rgba(0,0,0,.5); }
    p  { margin:0; font-size:13px; color:#a1a1aa; text-align:center; }
    .warn { color:#f87171; }
  </style>
</head>
<body>
  <h2>Escaneie com o WhatsApp do responsável</h2>
  <img id="qr" alt="QR Code (aguardando...)" src="qr-atual.png">
  <p id="status">Gerando QR... atualizo sozinho a cada ~5s.</p>
  <p class="warn">PRIVADO: não compartilhe nem exponha este QR.</p>
  <script>
    const img = document.getElementById('qr');
    const status = document.getElementById('status');
    setInterval(() => {
      img.src = 'qr-atual.png?t=' + Date.now();
      status.textContent = 'Atualizado: ' + new Date().toLocaleTimeString('pt-BR');
    }, 5000);
  </script>
</body>
</html>`;
    fs.writeFileSync(arquivoHtml, html);
  };
  try {
    gravar();
    cp.execSync(`start "" "${arquivoHtml}"`, { windowsHide: true, stdio: 'ignore' });
    console.log(`[qr] Popup aberto: ${arquivoHtml}`);
  } catch (err) {
    console.warn('[qr] falha ao abrir popup:', err.message);
  }
}

// Gera o QR como imagem (qr-atual.png) e abre o popup, se ainda não aberto.
// O popup usa a mesma imagem e a atualiza sozinha a cada QR novo.
function salvarQrPng(qr) {
  try {
    const dir = qrDir();
    fs.mkdirSync(dir, { recursive: true });
    const arquivo = path.join(dir, 'qr-atual.png');
    QRCode.toFile(arquivo, qr, { width: 360, margin: 2 }, (err) => {
      if (err) {
        console.warn('[qr] falha ao salvar PNG:', err.message);
        return;
      }
      console.log(`[qr] PNG salvo em ${arquivo}`);
    });
    abrirPopupQr();
  } catch (err) {
    console.warn('[qr] falha ao salvar PNG:', err.message);
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
      console.log('\nEscaneie o QR Code abaixo com o WhatsApp do responsável:\n');
      boxAviso([
        '⚠ ⚠ ⚠  PRIVADO  ⚠ ⚠ ⚠',
        'Este QR é pessoal e intransferível.',
        'Não rastreie, não compartilhe e não exponha o QR.',
        'Quem escanear terá acesso total ao seu WhatsApp.',
        'Escaneie apenas você, no seu próprio aparelho.',
      ]);
      console.log('');
      salvarQrPng(qr);
      qrcode.generate(qr, { small: true });
      console.log('');
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