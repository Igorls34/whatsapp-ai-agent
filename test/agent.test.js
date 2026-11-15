import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServiceCatalog, buildImageCatalog } from '../src/llm/agent.js';

test('buildServiceCatalog vazio remete ao responsável', () => {
  const s = buildServiceCatalog([], 'o Igor');
  assert.ok(s.includes('catálogo vazio'));
  assert.ok(s.includes('o Igor'));
});

test('buildServiceCatalog agrupa por categoria', () => {
  const servicos = [
    { nome: 'Montagem de PC', descricao: 'Monte seu PC', categoria: 'Montagem e Hardware' },
    { nome: 'Limpeza', descricao: '', categoria: 'Suporte e Diagnóstico' },
  ];
  const s = buildServiceCatalog(servicos);
  assert.ok(s.includes('Montagem de PC'));
  assert.ok(s.includes('Limpeza'));
  assert.ok(s.includes('### Montagem e Hardware'));
  assert.ok(s.includes('### Suporte e Diagnóstico'));
});

test('buildServiceCatalog nunca inclui preço', () => {
  const servicos = [{ nome: 'Serviço', descricao: 'X', categoria: '', preco: 'R$ 99' }];
  const s = buildServiceCatalog(servicos);
  assert.ok(!s.includes('preco'));
  assert.ok(!s.includes('R$'));
});

test('buildImageCatalog vazio retorna string vazia', () => {
  assert.equal(buildImageCatalog([]), '');
});

test('buildImageCatalog lista apelido e descrição', () => {
  const s = buildImageCatalog([{ apelido: 'logo_igor', descricao: 'Logo do negócio' }]);
  assert.ok(s.includes('logo_igor'));
  assert.ok(s.includes('Logo do negócio'));
});
