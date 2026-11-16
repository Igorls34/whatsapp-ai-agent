import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/http/router.js';
import { registrarRotasConfiguracoes } from '../src/http/routes/configuracoes.js';

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

function fakeReq(method, url, headers = {}, corpo = null) {
  const req = { method, url, headers };
  req.on = (ev, cb) => {
    if (ev === 'data' && corpo !== null) cb(corpo);
    else if (ev === 'end') cb();
    return req;
  };
  return req;
}

test('GET /api/configuracoes devolve o estado atual', async () => {
  const router = createRouter({ guards: { admin: () => true } });
  const settings = { paraPainel: () => ({ notificacoes: { whatsapp: '5511', email: 'a@b.c' }, agenda: { workSchedule: '1-4:12-21' } }) };
  registrarRotasConfiguracoes(router, { settings });

  const res = fakeRes();
  await router.handle(fakeReq('GET', '/api/configuracoes'), res);
  const dados = JSON.parse(res.body);
  assert.equal(dados.ok, true);
  assert.equal(dados.configuracoes.notificacoes.whatsapp, '5511');
});

test('PUT /api/configuracoes salva e re-seeda a agenda', async () => {
  const router = createRouter({ guards: { admin: () => true } });
  let salvo = null;
  let reaplicou = 0;
  const settings = {
    paraPainel: () => ({ notificacoes: {}, agenda: {} }),
    salvar: (patch) => {
      salvo = patch;
      return { notificacoes: {}, agenda: {} };
    },
  };
  registrarRotasConfiguracoes(router, { settings, onAgendaAlterada: () => reaplicou++ });

  const corpo = JSON.stringify({ agenda: { workSchedule: '1-5:9-18', scheduleStart: 8, scheduleEnd: 20, slotMinutes: 30, horizonDays: 7 } });
  const res = fakeRes();
  await router.handle(fakeReq('PUT', '/api/configuracoes', { 'content-type': 'application/json' }, corpo), res);

  assert.equal(res.status, 200);
  assert.equal(reaplicou, 1);
  assert.equal(salvo.agenda.workSchedule, '1-5:9-18');
  assert.equal(salvo.agenda.slotMinutes, 30);
});

test('PUT /api/configuracoes retorna 400 em agenda inválida', async () => {
  const router = createRouter({ guards: { admin: () => true } });
  const settings = {
    paraPainel: () => ({}),
    salvar: () => {
      throw new Error('Horários de trabalho inválidos.');
    },
  };
  registrarRotasConfiguracoes(router, { settings });

  const res = fakeRes();
  await router.handle(fakeReq('PUT', '/api/configuracoes', {}, JSON.stringify({ agenda: { workSchedule: 'x' } })), res);
  assert.equal(res.status, 400);
  assert.match(JSON.parse(res.body).erro, /inválidos/);
});
