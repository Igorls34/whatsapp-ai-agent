import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseToolEnvelope,
  buildToolResultMessage,
  withToolProtocol,
  TOOL_PROTOCOL_INSTRUCTIONS,
  TOOL_BEGIN,
  TOOL_END,
} from '../src/llm/toolProtocol.js';

test('parseToolEnvelope lê o envelope canônico', () => {
  const text = `${TOOL_BEGIN}\n{"name":"agendar_reuniao","arguments":{"data_hora":"2026-09-15T14:00"}}\n${TOOL_END}`;
  const call = parseToolEnvelope(text);
  assert.ok(call);
  assert.equal(call.name, 'agendar_reuniao');
  assert.equal(call.arguments.data_hora, '2026-09-15T14:00');
});

test('parseToolEnvelope ignora prosa antes e depois do envelope', () => {
  const text = `Claro!\n${TOOL_BEGIN}\n{"name":"consultar_disponibilidade","arguments":{"dias":3}}\n${TOOL_END}\nSó um instante.`;
  const call = parseToolEnvelope(text);
  assert.equal(call.name, 'consultar_disponibilidade');
  assert.deepEqual(call.arguments, { dias: 3 });
});

test('parseToolEnvelope tolera marcador sem fechamento', () => {
  const text = `${TOOL_BEGIN}\n{"name":"notificar_emergencia","arguments":{"telefone":"1","mensagem":"urgente"}}`;
  const call = parseToolEnvelope(text);
  assert.equal(call.name, 'notificar_emergencia');
  assert.equal(call.arguments.mensagem, 'urgente');
});

test('parseToolEnvelope retorna null para texto comum', () => {
  assert.equal(parseToolEnvelope('Oi, tudo bem?'), null);
  assert.equal(parseToolEnvelope(''), null);
  assert.equal(parseToolEnvelope(null), null);
});

test('buildToolResultMessage embute o nome e o resultado', () => {
  const msg = buildToolResultMessage('agendar_reuniao', { ok: true });
  assert.ok(msg.includes('agendar_reuniao'));
  assert.ok(msg.includes('"ok":true'));
});

test('withToolProtocol anexa o protocolo e é idempotente', () => {
  const base = 'system prompt base';
  const once = withToolProtocol(base);
  assert.ok(once.includes(TOOL_PROTOCOL_INSTRUCTIONS));
  assert.equal(withToolProtocol(once), once);
});
