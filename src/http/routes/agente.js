// Controles do agente pelo painel (aba WhatsApp).
//
// As ações "reiniciar"/"desligar"/"re-parear" mexem na unit systemd do próprio
// app (systemd --user). Como o app roda DENTRO dessa unit, as ações de restart/stop
// são disparadas "fire-and-forget" (spawn detached): o HTTP responde antes de o
// processo ser desligado/religado pelo systemd.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { json } from '../respond.js';

const UNIDADE = 'whatsapp-ai-agent';

// Dispara um comando systemd --user sem esperar (a unit pode matar este processo).
function dispararSystemctl(args) {
  const filho = spawn('systemctl', ['--user', ...args], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  filho.unref();
}

export function registrarRotasAgente(router, { config, qrState, disparar = dispararSystemctl }) {
  const admin = { guard: 'admin' };

  router.get(
    '/api/agente/status',
    ({ res }) => {
      const { conectado, qr } = qrState.estado();
      return json(res, 200, { ok: true, conectado, qrPendente: Boolean(qr) });
    },
    admin
  );

  router.post(
    '/api/agente/reiniciar',
    ({ res }) => {
      disparar(['restart', UNIDADE]);
      return json(res, 200, { ok: true, acao: 'reiniciar' });
    },
    admin
  );

  router.post(
    '/api/agente/desligar',
    ({ res }) => {
      disparar(['stop', UNIDADE]);
      return json(res, 200, { ok: true, acao: 'desligar' });
    },
    admin
  );

  router.post(
    '/api/agente/reparear',
    ({ res }) => {
      // Move a sessão atual para backup (não apaga) e reinicia: o app gera um QR novo.
      const dir = path.resolve(config.waSessionDir || './.sessions');
      try {
        if (fs.existsSync(dir)) {
          fs.renameSync(dir, `${dir}.backup-${Date.now()}`);
        }
      } catch (err) {
        return json(res, 500, { ok: false, erro: `Falha ao mover a sessão: ${err.message}` });
      }
      disparar(['restart', UNIDADE]);
      return json(res, 200, { ok: true, acao: 'reparear' });
    },
    admin
  );
}
