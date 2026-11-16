import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRouter } from '../src/http/router.js';
import { createQrState } from '../src/whatsapp/qrState.js';
import { registrarRotasAgente } from '../src/http/routes/agente.js';

function fakeRes() {
  return {
    status: null,
    body: '',
    writeHead(status) {
      this.status = status;
    },
    end(data) {
      if (data !== undefined) this.body += data;
    },
  };
}

function fakeReq(method, url) {
  return { method, url, on: () => ({}) };
}

function montar({ qrState = createQrState(), disparar = () => {}, config = {} } = {}) {
  const router = createRouter({ guards: { admin: () => true } });
  registrarRotasAgente(router, { config, qrState, disparar });
  return router;
}

test('GET /api/agente/status reporta o estado do WhatsApp', async () => {
  const qrState = createQrState();
  qrState.definirQr('codigo');
  const router = montar({ qrState });

  const res = fakeRes();
  await router.handle(fakeReq('GET', '/api/agente/status'), res);
  const dados = JSON.parse(res.body);
  assert.equal(dados.ok, true);
  assert.equal(dados.conectado, false);
  assert.equal(dados.qrPendente, true);
});

test('POST reiniciar/desligar disparam o systemctl correto', async () => {
  const chamadas = [];
  const router = montar({ disparar: (args) => chamadas.push(args) });

  await router.handle(fakeReq('POST', '/api/agente/reiniciar'), fakeRes());
  await router.handle(fakeReq('POST', '/api/agente/desligar'), fakeRes());

  assert.deepEqual(chamadas, [['restart', 'whatsapp-ai-agent'], ['stop', 'whatsapp-ai-agent']]);
});

test('POST re-parear move a sessão para backup e reinicia', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-sessao-'));
  fs.mkdirSync(path.join(dir, 'creds'));
  fs.writeFileSync(path.join(dir, 'creds', 'x.json'), '{}');

  const chamadas = [];
  const router = montar({
    config: { waSessionDir: dir },
    disparar: (args) => chamadas.push(args),
  });

  const res = fakeRes();
  await router.handle(fakeReq('POST', '/api/agente/reparear'), res);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0], ['restart', 'whatsapp-ai-agent']);

  // sessão original movida para backup
  assert.equal(fs.existsSync(dir), false);
  const backups = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith(path.basename(dir) + '.backup-'));
  assert.equal(backups.length, 1);
  for (const b of backups) fs.rmSync(path.join(os.tmpdir(), b), { recursive: true, force: true });
});
