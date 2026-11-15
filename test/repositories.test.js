import test from 'node:test';
import assert from 'node:assert/strict';
import { toLocalIso, addDaysIso } from '../src/db/repositories.js';

test('toLocalIso formata data local em ISO sem segundos', () => {
  const d = new Date(2026, 8, 15, 14, 5); // 15/09/2026 14:05 (local)
  assert.equal(toLocalIso(d), '2026-09-15T14:05');
});

test('toLocalIso completa com zero à esquerda', () => {
  const d = new Date(2026, 0, 3, 9, 7); // 03/01/2026 09:07
  assert.equal(toLocalIso(d), '2026-01-03T09:07');
});

test('addDaysIso retorna string no formato ISO local', () => {
  const iso = addDaysIso(1);
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
