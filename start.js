#!/usr/bin/env node
// Supervisor plug-and-play:
//  - garante o opencode serve (porta 4096) no ar, subindo-o como filho se não estiver;
//  - sobe o bot (src/index.js);
//  - reinicia o bot se cair, e reinicia o opencode server se ele morrer.
//
// Uso: npm start   (ou: node start.js)
import 'dotenv/config';
import { spawn } from 'node:child_process';

const SERVIDOR_URL = process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096';
const PING_MS = 2000;
const ESPERAR_SERVIDOR_MS = 90_000;
const REINICIAR_BOT_BASE_MS = 3_000;
const REINICIAR_BOT_MAX_MS = 30_000;
const REINICIAR_OPCODE_MS = 5_000;
const RESETAR_BACKOFF_APOS_MS = 30_000;

let abertoOpencode = null;
let bot = null;
let forwardExit = false;

function parseUrl(url) {
  try {
    const u = new URL(url);
    return { hostname: u.hostname, port: u.port || 80 };
  } catch {
    return null;
  }
}

async function servidorSaude() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1_500);
    const res = await fetch(`${SERVIDOR_URL}/global/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function log(prefixo, msg) {
  const hora = new Date().toLocaleTimeString('pt-BR');
  console.log(`[${hora}][${prefixo}] ${msg}`);
}

async function aguardarServidorDisponivel() {
  const inicio = Date.now();
  while (Date.now() - inicio < ESPERAR_SERVIDOR_MS) {
    if (await servidorSaude()) return true;
    await new Promise((r) => setTimeout(r, PING_MS));
  }
  return false;
}

function subirOpencode() {
  const { hostname, port } = parseUrl(SERVIDOR_URL) || { hostname: '127.0.0.1', port: 4096 };
  log('supervisor', `opencode serve não responde em ${SERVIDOR_URL} — subindo na ${hostname}:${port}…`);
  const child = spawn('opencode', ['serve', '--port', String(port)], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || '',
      ...(process.env.OPENCODE_SERVER_USERNAME
        ? { OPENCODE_SERVER_USERNAME: process.env.OPENCODE_SERVER_USERNAME }
        : {}),
    },
  });
  child.on('exit', (code, signal) => {
    if (forwardExit) return;
    log('supervisor', `opencode serve saiu (code=${code} signal=${signal}) — reiniciando em ${REINICIAR_OPCODE_MS}ms…`);
    setTimeout(() => {
      if (!forwardExit) subirOpencode();
    }, REINICIAR_OPCODE_MS);
  });
  child.on('error', (err) => {
    log('supervisor', `Falha ao iniciar opencode: ${err.message}`);
    log('supervisor', 'Instale com: npm install -g opencode-ai   (ou rode: npm run setup)');
  });
  abertoOpencode = child;
}

async function garantirServidor() {
  if (await servidorSaude()) {
    log('supervisor', 'opencode server já está no ar ✅');
    return;
  }
  subirOpencode();
  const ok = await aguardarServidorDisponivel();
  if (!ok) {
    log('supervisor', '⚠️ Não consegui confirmar o opencode serve no tempo. O bot vai tentar mesmo assim — se não responder, ele avisa o cliente.');
  } else {
    log('supervisor', 'opencode server pronto ✅');
  }
}

function subirBot() {
  log('supervisor', 'Iniciando o bot do WhatsApp…');
  bot = spawn(process.execPath, ['src/index.js'], { stdio: 'inherit' });
  botStartedAt = Date.now();
  bot.on('exit', (code, signal) => {
    if (forwardExit) return;
    const motivo = code === 0 ? 'encerrou normalmente' : `saiu (code=${code} signal=${signal})`;
    const rodouDeLongo = Date.now() - botStartedAt >= RESETAR_BACKOFF_APOS_MS;
    if (rodouDeLongo) backoff = REINICIAR_BOT_BASE_MS;
    const delay = rodouDeLongo ? REINICIAR_BOT_BASE_MS : Math.min(backoff, REINICIAR_BOT_MAX_MS);
    log('supervisor', `Bot ${motivo} — reiniciando em ${delay}ms…`);
    backoff = Math.min(backoff * 2, REINICIAR_BOT_MAX_MS);
    setTimeout(() => {
      if (!forwardExit) subirBot();
    }, delay);
  });
  bot.on('error', (err) => {
    log('supervisor', `Erro ao iniciar o bot: ${err.message}`);
  });
}

function parar() {
  forwardExit = true;
  log('supervisor', 'Encerrando (Ctrl+C recebido)…');
  if (bot) bot.kill('SIGTERM');
  if (abertoOpencode) abertoOpencode.kill('SIGTERM');
  process.exit(0);
}

let botStartedAt = 0;
let backoff = REINICIAR_BOT_BASE_MS;

async function main() {
  await garantirServidor();
  subirBot();
}

process.on('SIGINT', parar);
process.on('SIGTERM', parar);

main().catch((err) => {
  forwardExit = true;
  console.error('[supervisor] falha fatal:', err);
  if (abertoOpencode) abertoOpencode.kill('SIGTERM');
  process.exit(1);
});