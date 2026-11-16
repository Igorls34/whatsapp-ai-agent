import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox } from '../src/notifications/outbox.js';

const loggerSilencioso = { log() {}, error() {} };
const semPausa = { run: (fn) => fn() };

function fakeRepos(inicial = []) {
  let seq = 1;
  const avisos = inicial.map((a) => ({ id: seq++, texto: a.texto, destino: a.destino ?? null }));
  return {
    avisos,
    enfileirarAviso(texto, destino = null) {
      avisos.push({ id: seq++, texto, destino });
    },
    listarAvisosPendentes(limite = 25) {
      return avisos.slice(0, limite);
    },
    removerAviso(id) {
      const i = avisos.findIndex((a) => a.id === id);
      if (i >= 0) avisos.splice(i, 1);
    },
    contarAvisosPendentes() {
      return avisos.length;
    },
  };
}

function fakeSocket({ falhar = false } = {}) {
  const enviados = [];
  return {
    enviados,
    async sendMessage(jid, payload) {
      if (falhar) throw new Error('socket fora do ar');
      enviados.push({ jid, texto: payload.text });
    },
  };
}

test('outbox envia direto quando o socket existe', async () => {
  const repos = fakeRepos();
  const socket = fakeSocket();
  const outbox = createOutbox({ repos, getSocket: () => socket, pacer: semPausa, logger: loggerSilencioso });

  const r = await outbox.enviar({ telefone: '5511999999999', texto: 'oi' });
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(socket.enviados, [{ jid: '5511999999999@s.whatsapp.net', texto: 'oi' }]);
  assert.equal(repos.contarAvisosPendentes(), 0);
});

test('outbox enfileira quando não há socket', async () => {
  const repos = fakeRepos();
  const outbox = createOutbox({ repos, getSocket: () => null, pacer: semPausa, logger: loggerSilencioso });

  const r = await outbox.enviar({ telefone: '5511888888888', texto: 'agendou' });
  assert.deepEqual(r, { ok: true, motivo: 'enfileirado' });
  assert.equal(repos.contarAvisosPendentes(), 1);
  assert.equal(repos.avisos[0].destino, '5511888888888');
});

test('outbox drena a fila quando o socket conecta (destino próprio ou padrão)', async () => {
  const repos = fakeRepos([
    { texto: 'para o Igor', destino: '5511777777777' },
    { texto: 'sem destino (usa padrão)', destino: null },
  ]);
  const socket = fakeSocket();
  const outbox = createOutbox({
    repos,
    getSocket: () => socket,
    pacer: semPausa,
    numeroPadrao: '5511000000000',
    logger: loggerSilencioso,
  });

  const r = await outbox.drenar();
  assert.equal(r.enviados, 2);
  assert.equal(repos.contarAvisosPendentes(), 0);
  assert.deepEqual(
    socket.enviados.map((e) => e.jid),
    ['5511777777777@s.whatsapp.net', '5511000000000@s.whatsapp.net']
  );
});

test('falha no envio com socket enfileira e mantém para retry', async () => {
  const repos = fakeRepos();
  const socket = fakeSocket({ falhar: true });
  const outbox = createOutbox({
    repos,
    getSocket: () => socket,
    pacer: semPausa,
    logger: loggerSilencioso,
    retryBaseMs: 60_000,
  });

  const r = await outbox.enviar({ telefone: '5511666666666', texto: 'falhou' });
  assert.equal(r.ok, false);
  assert.equal(repos.contarAvisosPendentes(), 1);
  assert.equal(repos.avisos[0].destino, '5511666666666');
});

test('drenagem descarta o aviso após o máximo de tentativas', async () => {
  const repos = fakeRepos([{ texto: 'teimoso', destino: '5511555555555' }]);
  const socket = fakeSocket({ falhar: true });
  const outbox = createOutbox({
    repos,
    getSocket: () => socket,
    pacer: semPausa,
    logger: loggerSilencioso,
    maxTentativas: 2,
    retryBaseMs: 60_000,
  });

  await outbox.drenar(); // tentativa 1
  assert.equal(repos.contarAvisosPendentes(), 1);
  await outbox.drenar(); // tentativa 2 -> descarta
  assert.equal(repos.contarAvisosPendentes(), 0);

  outbox.parar();
});

test('chamadas concorrentes de drenar não duplicam envios', async () => {
  const repos = fakeRepos([{ texto: 'único', destino: '5511444444444' }]);
  const enviados = [];
  const socket = {
    async sendMessage(jid, payload) {
      await new Promise((r) => setTimeout(r, 10));
      enviados.push({ jid, texto: payload.text });
    },
  };
  const outbox = createOutbox({ repos, getSocket: () => socket, pacer: semPausa, logger: loggerSilencioso });

  await Promise.all([outbox.drenar(), outbox.drenar(), outbox.drenar()]);
  assert.equal(enviados.length, 1);
  assert.equal(repos.contarAvisosPendentes(), 0);
});
