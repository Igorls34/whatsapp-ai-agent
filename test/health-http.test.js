import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRouter } from '../src/http/router.js';
import { createQrState } from '../src/whatsapp/qrState.js';
import { registrarRotasHealth } from '../src/http/routes/health.js';

// Integração real (TCP + fetch) do /health: é o mesmo caminho que o deploy usa.
function subirServidor(router) {
  const servidor = http.createServer(async (req, res) => {
    const tratado = await router.handle(req, res);
    if (!tratado) {
      res.writeHead(404).end('nao encontrado');
    }
  });
  return new Promise((resolve) => {
    servidor.listen(0, '127.0.0.1', () => {
      const { port } = servidor.address();
      resolve({ servidor, url: `http://127.0.0.1:${port}` });
    });
  });
}

function brainFake({ dbOk = true, avisos = 0 } = {}) {
  return {
    db: {
      prepare: () => ({
        get: () => {
          if (!dbOk) throw new Error('db fora do ar');
          return { ok: 1 };
        },
      }),
    },
    adapter: { health: async () => ({ version: '0.0.0-test' }) },
    repos: { contarAvisosPendentes: () => avisos },
  };
}

test('GET /health responde JSON com versão do app por HTTP real', async () => {
  const router = createRouter();
  const qrState = createQrState();
  qrState.conectar();
  registrarRotasHealth(router, { brain: brainFake({ avisos: 2 }), qrState });

  const { servidor, url } = await subirServidor(router);
  try {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const dados = await res.json();

    assert.equal(dados.ok, true);
    assert.equal(typeof dados.app?.versao, 'string');
    assert.match(dados.app.versao, /^\d+\.\d+\.\d+/);
    assert.equal(dados.whatsapp.conectado, true);
    assert.deepEqual(dados.notificacoes, { pendentes: 2 });
    assert.equal(dados.db.ok, true);
    assert.equal(dados.llm.ok, true);
  } finally {
    await new Promise((r) => servidor.close(r));
  }
});

test('GET /health responde 503 quando o banco falha', async () => {
  const router = createRouter();
  const qrState = createQrState();
  registrarRotasHealth(router, { brain: brainFake({ dbOk: false }), qrState });

  const { servidor, url } = await subirServidor(router);
  try {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 503);
    const dados = await res.json();
    assert.equal(dados.ok, false);
    assert.equal(dados.db.ok, false);
  } finally {
    await new Promise((r) => servidor.close(r));
  }
});
