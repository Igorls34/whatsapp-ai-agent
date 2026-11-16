#!/usr/bin/env node
// Supervisor plug-and-play — UM comando sobe tudo:
//   - IA local:  opencode serve  (http://127.0.0.1:4096)
//   - Sistema:   src/index.js    (WhatsApp + chat + painel + QR + health)
//
// O app é UM processo só: o HTTP unificado nasce junto com o bot. Cada serviço
// é reiniciado sozinho (com backoff) se cair; o opencode primeiro checa se já
// existe alguém no ar — se já estiver, não duplica. Ctrl+C encerra tudo junto.
//
// Uso: npm start   (ou: node start.js)
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { config } from './src/config.js';

const IA_URL = config.llm.opencode.url;
const PING_MS = 2_000;
const ESPERAR_SERVIDOR_MS = 90_000;
const REINICIAR_BASE_MS = 3_000;
const REINICIAR_MAX_MS = 30_000;
const RESETAR_BACKOFF_APOS_MS = 30_000;

let forwardExit = false;

function log(prefixo, msg) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${hora}][${prefixo}] ${msg}`);
}

function parseUrl(url) {
  try {
    const u = new URL(url);
    return { hostname: u.hostname, port: u.port || 80 };
  } catch {
    return null;
  }
}

async function saudavel(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1_500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function criarSupervisao({ nome, comando, args, url = null, esperarAtivo = false, env = {}, shell = false }) {
  const estado = { filho: null, criadoEm: 0, backoff: REINICIAR_BASE_MS };

  function subir() {
    log('supervisor', `Subindo ${nome}…`);
    estado.filho = spawn(comando, args, { shell, stdio: 'inherit', env: { ...process.env, ...env } });
    estado.criadoEm = Date.now();
    estado.filho.on('exit', (code, signal) => {
      if (forwardExit) return;
      const rodouDeLongo = Date.now() - estado.criadoEm >= RESETAR_BACKOFF_APOS_MS;
      if (rodouDeLongo) estado.backoff = REINICIAR_BASE_MS;
      const delay = rodouDeLongo ? REINICIAR_BASE_MS : Math.min(estado.backoff, REINICIAR_MAX_MS);
      log('supervisor', `${nome} saiu (code=${code} signal=${signal}) — reiniciando em ${delay}ms…`);
      estado.backoff = Math.min(estado.backoff * 2, REINICIAR_MAX_MS);
      setTimeout(() => {
        if (!forwardExit) subir();
      }, delay);
    });
    estado.filho.on('error', (err) => {
      log('supervisor', `Falha ao iniciar ${nome}: ${err.message}`);
      if (nome.includes('opencode')) {
        log('supervisor', 'Instale com: npm install -g opencode-ai   (ou rode: npm run setup)');
      }
    });
    return estado.filho;
  }

  async function verificarECobrir() {
    if (url && (await saudavel(url))) {
      log('supervisor', `${nome} já está no ar ✅ (${url})`);
      return null;
    }
    if (nome.includes('opencode')) {
      log('supervisor', `${nome} não responde em ${url} — subindo…`);
    }
    subir();
    if (url && esperarAtivo) {
      const inicio = Date.now();
      while (Date.now() - inicio < ESPERAR_SERVIDOR_MS) {
        if (await saudavel(url)) {
          log('supervisor', `${nome} pronto ✅`);
          return estado.filho;
        }
        await new Promise((r) => setTimeout(r, PING_MS));
      }
      log('supervisor', `⚠️ ${nome} não respondeu no tempo — seguindo mesmo assim.`);
    }
    return estado.filho;
  }

  return { verificarECobrir, matar: () => estado.filho?.kill('SIGTERM') };
}

function parar() {
  forwardExit = true;
  log('supervisor', 'Encerrando (Ctrl+C recebido)…');
  for (const s of servicos) s.matar();
  process.exit(0);
}

const servicos = [];

async function main() {
  const { hostname, port } = parseUrl(IA_URL) || { hostname: '127.0.0.1', port: 4096 };

  const ia = criarSupervisao({
    nome: 'IA local (opencode serve)',
    comando: 'opencode',
    args: ['serve', '--port', String(port)],
    url: `${IA_URL}/global/health`,
    esperarAtivo: true,
    shell: true,
    env: {
      OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || '',
      ...(process.env.OPENCODE_SERVER_USERNAME
        ? { OPENCODE_SERVER_USERNAME: process.env.OPENCODE_SERVER_USERNAME }
        : {}),
    },
  });

  const app = criarSupervisao({
    nome: 'app (WhatsApp + HTTP unificado)',
    comando: process.execPath,
    args: ['src/index.js'],
    // O healthcheck sempre bate em localhost (mesmo se o app escutar em 0.0.0.0).
    url: `http://127.0.0.1:${config.http.port}/health`,
  });

  servicos.push(ia, app);

  await ia.verificarECobrir();
  app.verificarECobrir();
}

process.on('SIGINT', parar);
process.on('SIGTERM', parar);

main().catch((err) => {
  forwardExit = true;
  console.error('[supervisor] falha fatal:', err);
  for (const s of servicos) s.matar();
  process.exit(1);
});