import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openDatabase } from '../src/db/database.js';
import { createRepositories } from '../src/db/repositories.js';

test('openDatabase migra avisos_pendentes antigos adicionando destino', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-migra-'));
  const arquivo = path.join(dir, 'antigo.db');

  const antigo = new Database(arquivo);
  antigo.exec(`
    CREATE TABLE avisos_pendentes (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      texto     TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);
  antigo.prepare('INSERT INTO avisos_pendentes (texto) VALUES (?)').run('aviso antigo');
  antigo.close();

  const db = openDatabase(arquivo);
  try {
    const colunas = db.prepare('PRAGMA table_info(avisos_pendentes)').all().map((c) => c.name);
    assert.ok(colunas.includes('destino'), 'coluna destino deve existir');

    const repos = createRepositories(db);
    const [legado] = repos.listarAvisosPendentes();
    assert.equal(legado.texto, 'aviso antigo');
    assert.equal(legado.destino, null);

    repos.enfileirarAviso('novo aviso', '5511999999999');
    const pendentes = repos.listarAvisosPendentes();
    assert.equal(pendentes.length, 2);
    assert.equal(pendentes[1].destino, '5511999999999');
    assert.equal(repos.contarAvisosPendentes(), 2);

    repos.removerAviso(pendentes[1].id);
    assert.equal(repos.contarAvisosPendentes(), 1);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
