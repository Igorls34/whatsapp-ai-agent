import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/http/router.js';
import { createQrState } from '../src/whatsapp/qrState.js';
import { registrarRotasQr } from '../src/http/routes/qr.js';

function fakeRes() {
  return {
    status: null,
    headers: {},
    body: '',
    headersSent: false,
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
    },
    end(data) {
      if (data !== undefined) this.body += data;
    },
  };
}

function fakeReq(method, url, headers = {}) {
  return { method, url, headers };
}

test('router casa parâmetro dinâmico e expõe params', async () => {
  const router = createRouter();
  let recebido = null;
  router.get('/api/servicos/:id', ({ params, res }) => {
    recebido = params;
    res.writeHead(200);
    res.end('ok');
  });

  const res = fakeRes();
  const tratado = await router.handle(fakeReq('GET', '/api/servicos/42'), res);
  assert.equal(tratado, true);
  assert.deepEqual(recebido, { id: '42' });
  assert.equal(res.status, 200);
});

test('router ignora método diferente e retorna false quando nada casa', async () => {
  const router = createRouter();
  router.post('/api/chat', ({ res }) => res.end('x'));

  assert.equal(await router.handle(fakeReq('GET', '/api/chat'), fakeRes()), false);
  assert.equal(await router.handle(fakeReq('GET', '/nao-existe'), fakeRes()), false);
});

test('router aceita barra final e decodifica params', async () => {
  const router = createRouter();
  let telefone = null;
  router.put('/api/clientes/:telefone', ({ params, res }) => {
    telefone = params.telefone;
    res.end();
  });

  await router.handle(fakeReq('PUT', '/api/clientes/5511%209999'), fakeRes());
  assert.equal(telefone, '5511 9999');
  await router.handle(fakeReq('PUT', '/api/clientes/123/'), fakeRes());
  assert.equal(telefone, '123');
});

test('guard admin bloqueia sem token e libera com Bearer', async () => {
  const token = 'segredo';
  const router = createRouter({ guards: { admin: (req) => req.headers.authorization === `Bearer ${token}` } });
  router.get('/api/dashboard', ({ res }) => res.end('painel'), { guard: 'admin' });
  router.get('/health', ({ res }) => res.end('ok')); // sem guard

  const semAuth = fakeRes();
  await router.handle(fakeReq('GET', '/api/dashboard'), semAuth);
  assert.equal(semAuth.status, 401);
  assert.ok(semAuth.body.includes('Não autorizado'));

  const comAuth = fakeRes();
  await router.handle(fakeReq('GET', '/api/dashboard', { authorization: `Bearer ${token}` }), comAuth);
  assert.equal(comAuth.body, 'painel');

  const health = fakeRes();
  await router.handle(fakeReq('GET', '/health'), health);
  assert.equal(health.body, 'ok');
});

test('qrState: QR define estado, conectar limpa e desconectar mantém fora', () => {
  const qr = createQrState();
  assert.deepEqual(qr.estado(), { conectado: false, qr: null, atualizadoEm: null });

  qr.definirQr('codigo-123');
  const comQr = qr.estado();
  assert.equal(comQr.conectado, false);
  assert.equal(comQr.qr, 'codigo-123');
  assert.equal(typeof comQr.atualizadoEm, 'number');

  qr.conectar();
  assert.deepEqual(qr.estado(), { conectado: true, qr: null, atualizadoEm: null });

  qr.desconectar();
  assert.equal(qr.estado().conectado, false);
});

test('GET /api/qr responde o estado atual do pareamento', async () => {
  const router = createRouter();
  const qrState = createQrState();
  registrarRotasQr(router, { qrState });

  const antes = fakeRes();
  await router.handle(fakeReq('GET', '/api/qr'), antes);
  const dadosAntes = JSON.parse(antes.body);
  assert.equal(dadosAntes.ok, true);
  assert.equal(dadosAntes.temQr, false);
  assert.equal(dadosAntes.conectado, false);

  qrState.definirQr('abc');
  const depois = fakeRes();
  await router.handle(fakeReq('GET', '/api/qr'), depois);
  const dadosDepois = JSON.parse(depois.body);
  assert.equal(dadosDepois.temQr, true);
  assert.equal(dadosDepois.conectado, false);
});
