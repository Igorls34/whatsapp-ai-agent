import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverModel } from '../src/llm/localOpencodeAdapter.js';

test('resolverModel converte "provider/model" em objeto', () => {
  assert.deepEqual(resolverModel('opencode/big-pickle'), { providerID: 'opencode', modelID: 'big-pickle' });
  assert.deepEqual(resolverModel('anthropic/claude-sonnet-4-5'), { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' });
});

test('resolverModel preserva objeto já montado', () => {
  const obj = { providerID: 'x', modelID: 'y' };
  assert.deepEqual(resolverModel(obj), obj);
});

test('resolverModel retorna null para vazio/malformado', () => {
  assert.equal(resolverModel(null), null);
  assert.equal(resolverModel(undefined), null);
  assert.equal(resolverModel(''), null);
  assert.equal(resolverModel('sem-barra'), null);
});
