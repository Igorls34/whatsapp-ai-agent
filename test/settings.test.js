import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSettingsManager } from '../src/settings/manager.js';

function configFake() {
  return {
    settingsPath: '',
    notificacoes: { whatsapp: '5511999999999', email: 'igor@exemplo.com', smtp: {} },
    agenda: {
      workSchedule: '1-4:12-21,5:10-19,6:8-14',
      scheduleStart: 7,
      scheduleEnd: 24,
      slotMinutes: 60,
      horizonDays: 14,
    },
  };
}

function criarManager() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-settings-'));
  const filePath = path.join(dir, 'settings.json');
  const cfg = configFake();
  cfg.settingsPath = filePath;
  const m = createSettingsManager({ filePath, config: cfg });
  return { m, dir, filePath, cfg };
}

test('settings: notificacoes caem no .env quando nada foi salvo', () => {
  const { m, cfg } = criarManager();
  assert.deepEqual(m.notificacoes(), { whatsapp: cfg.notificacoes.whatsapp, email: cfg.notificacoes.email });
});

test('settings: salvar notificacoes sobrescreve o .env e persiste no disco', () => {
  const { m, dir, filePath, cfg } = criarManager();
  const antes = m.salvar({ notificacoes: { whatsapp: '5511777777777', email: 'novo@exemplo.com' } });
  assert.equal(antes.notificacoes.whatsapp, '5511777777777');
  assert.equal(antes.notificacoes.email, 'novo@exemplo.com');

  // novo manager (processo "reinicidado") lê do disco
  const m2 = createSettingsManager({ filePath, config: cfg });
  assert.equal(m2.notificacoes().whatsapp, '5511777777777');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('settings: agenda usa .env por padrão e parseia os horários', () => {
  const { m } = criarManager();
  const a = m.agenda();
  assert.equal(a.scheduleStart, 7);
  assert.equal(a.slotMinutes, 60);
  assert.deepEqual(a.workBlocked[1], [{ start: 12, end: 21 }]);
});

test('settings: salvar agenda altera workBlocked e persiste', () => {
  const { m, dir, filePath, cfg } = criarManager();
  m.salvar({ agenda: { workSchedule: '1-5:9-18', scheduleStart: 8, scheduleEnd: 20, slotMinutes: 30, horizonDays: 7 } });

  const a = m.agenda();
  assert.deepEqual(a.workBlocked[1], [{ start: 9, end: 18 }]);
  assert.deepEqual(a.workBlocked[5], [{ start: 9, end: 18 }]);
  assert.equal(a.scheduleStart, 8);
  assert.equal(a.slotMinutes, 30);

  const m2 = createSettingsManager({ filePath, config: cfg });
  assert.equal(m2.agenda().slotMinutes, 30);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('settings: rejeita horário de trabalho inválido', () => {
  const { m } = criarManager();
  assert.throws(() => m.salvar({ agenda: { workSchedule: 'abc' } }), /Horários de trabalho inválidos/);
  assert.throws(() => m.salvar({ agenda: { scheduleEnd: 5 } }), /Fim do dia/);
  assert.throws(() => m.salvar({ agenda: { slotMinutes: 0 } }), /Duração do slot/);
});
