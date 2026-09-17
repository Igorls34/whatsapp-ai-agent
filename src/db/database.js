import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { SCHEMA } from './schema.js';

// Categorias atribuídas automaticamente aos serviços já cadastrados
// (banco pré-existente). Matching por padrões em nome+descrição, em ordem de
// prioridade. Só preenche serviços que ainda estão sem categoria ('').
const CATEGORIAS_SERVICOS = [
  { categoria: 'Educação e E-learning', match: /captivate|e-learning/i },
  { categoria: 'Design Gráfico', match: /photoshop|illustrator|indesign|corel|design/i },
  { categoria: 'Edição de Vídeo', match: /premiere|after effects|filmora|v[íi]deo/i },
  { categoria: 'Arquitetura e Modelagem', match: /revit|sketchup|vray|3d studio|3ds max|modelagem|arquitetura/i },
  { categoria: 'Engenharia', match: /autocad|robot structural|cype|catia|solidworks|mec[âa]nic|engenharia/i },
  { categoria: 'Montagem e Hardware', match: /montagem|ssd|ram|hardware|upgrade/i },
  { categoria: 'Suporte e Diagnóstico', match: /diagn|or[çc]amento|analise de defeito|suporte t[ée]cnico/i },
  { categoria: 'Dados e Gestão', match: /power bi|ms project|\bproject\b|dados|gest[ãa]o|gerenci/i },
  { categoria: 'Desenvolvimento', match: /visual studio|\bdev\b|desenvolvimento/i },
  { categoria: 'Escritório e Sistemas', match: /windows|office|escrit[óo]rio|sistemas operacionais/i },
];

function migrarCategoriaServicos(db) {
  const colunas = db.prepare('PRAGMA table_info(servicos)').all();
  if (!colunas.some((c) => c.name === 'categoria')) {
    db.exec(`ALTER TABLE servicos ADD COLUMN categoria TEXT NOT NULL DEFAULT ''`);
  }

  const pendentes = db
    .prepare(`SELECT id, nome, descricao FROM servicos WHERE categoria = ''`)
    .all();
  if (!pendentes.length) return;

  const update = db.prepare(`
    UPDATE servicos SET categoria = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?
  `);
  for (const row of pendentes) {
    const alvo = `${row.nome} ${row.descricao}`;
    for (const { categoria, match } of CATEGORIAS_SERVICOS) {
      if (match.test(alvo)) {
        update.run(categoria, row.id);
        break;
      }
    }
  }
}

export function openDatabase(dbPath = config.dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrarCategoriaServicos(db);
  return db;
}