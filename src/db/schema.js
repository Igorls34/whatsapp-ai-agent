export const SCHEMA = `
-- ============================================================================
-- Clientes (memória de longo prazo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  telefone           TEXT NOT NULL UNIQUE,
  nome               TEXT,
  resumo             TEXT NOT NULL DEFAULT '',
  ultima_interacao_at TEXT,
  criado_em          TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em      TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  chat_fechado       INTEGER NOT NULL DEFAULT 0,
  motivo_bloqueio    TEXT,
  bloqueado_em       TEXT,
  desbloqueio_em     TEXT
);

-- ============================================================================
-- Agenda (horários livres + reuniões marcadas)
-- status: 'livre' | 'agendado' | 'confirmada' | 'cancelada'
-- ============================================================================
CREATE TABLE IF NOT EXISTS agenda (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  data_hora       TEXT NOT NULL UNIQUE,          -- formato ISO local: 2026-09-15T14:00
  status          TEXT NOT NULL DEFAULT 'livre'
                    CHECK (status IN ('livre', 'agendado', 'confirmada', 'cancelada')),
  cliente_telefone TEXT,
  cliente_nome    TEXT,
  motivo          TEXT,
  resumo          TEXT,
  criado_em       TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_agenda_status ON agenda (status, data_hora);
CREATE INDEX IF NOT EXISTS idx_agenda_cliente ON agenda (cliente_telefone);

-- ============================================================================
-- Avisos pendentes (fila) — escritos por processos sem WhatsApp (chat web,
-- painel) e entregues pelo bot, que tem o socket. Ex.: agendamento novo.
-- ============================================================================
CREATE TABLE IF NOT EXISTS avisos_pendentes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  texto     TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ============================================================================
-- Serviços oferecidos pelo negócio (catálogo editável manualmente)
-- ativo=0 esconde o serviço sem apagar; ordem controla a exibição.
-- categoria agrupa os serviços para o bot apresentar de forma organizada.
-- ============================================================================
CREATE TABLE IF NOT EXISTS servicos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  descricao   TEXT NOT NULL DEFAULT '',
  categoria   TEXT NOT NULL DEFAULT '',
  preco       TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  ordem       INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
`;