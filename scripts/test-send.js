import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import { config } from '../src/config.js';

const alvo = process.argv[2] || '5524998190280';

const { version } = await fetchLatestBaileysVersion();
const { state, saveCreds } = await useMultiFileAuthState(config.waSessionDir);

const socket = makeWASocket({ version, auth: state });
socket.ev.on('creds.update', saveCreds);

socket.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  if (connection === 'open') {
    console.log(`[test-send] conectado. Enviando teste para ${alvo}...`);
    try {
      const jid = `${alvo}@s.whatsapp.net`;
      await socket.sendMessage(jid, { text: 'Teste do bot IA do Igor ✅ Conexão, descriptografia e envio funcionando.' });
      console.log('[test-send] enviada com sucesso.');
    } catch (err) {
      console.error('[test-send] erro ao enviar:', err);
    }
    setTimeout(() => process.exit(0), 3000);
  }
  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode;
    console.error(`[test-send] conexão fechada (${code === DisconnectReason.loggedOut ? 'logout' : code})`);
    process.exit(1);
  }
});

setTimeout(() => {
  console.error('[test-send] timeout aguardando conexão');
  process.exit(1);
}, 30000);