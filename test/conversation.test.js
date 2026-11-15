import test from 'node:test';
import assert from 'node:assert/strict';
import { separarPartes, MSG_SEPARATOR } from '../src/conversation/service.js';

test('separarPartes divide por |||', () => {
  assert.deepEqual(separarPartes('a ||| b ||| c'), ['a', 'b', 'c']);
});

test('separarPartes apara espaços e remove partes vazias', () => {
  assert.deepEqual(separarPartes('  oi  '), ['oi']);
  assert.deepEqual(separarPartes('a |||   ||| b'), ['a', 'b']);
  assert.deepEqual(separarPartes(''), []);
});

test('MSG_SEPARATOR é |||', () => {
  assert.equal(MSG_SEPARATOR, '|||');
});
