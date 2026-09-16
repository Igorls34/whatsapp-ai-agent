const pad = (n) => String(n).padStart(2, '0');

export function toLocalIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDaysIso(days) {
  const d = new Date(Date.now() + days * 86400000);
  return toLocalIso(d);
}

export function createRepositories(db) {
  const stmts = {
    getCliente: db.prepare('SELECT * FROM clientes WHERE telefone = ?'),

    upsertCliente: db.prepare(`
      INSERT INTO clientes (telefone, nome, atualizado_em)
      VALUES (@telefone, @nome, datetime('now', 'localtime'))
      ON CONFLICT(telefone) DO UPDATE SET
        nome = COALESCE(@nome, nome),
        atualizado_em = datetime('now', 'localtime')
    `),

    atualizarResumo: db.prepare(`
      INSERT INTO clientes (telefone, resumo, atualizado_em)
      VALUES (@telefone, @resumo, datetime('now', 'localtime'))
      ON CONFLICT(telefone) DO UPDATE SET
        resumo = @resumo,
        atualizado_em = datetime('now', 'localtime')
    `),

    tocarInteracao: db.prepare(`
      UPDATE clientes SET ultima_interacao_at = datetime('now', 'localtime')
      WHERE telefone = ?
    `),

    slotsNoIntervalo: db.prepare(`
      SELECT * FROM agenda
      WHERE status = 'livre'
        AND data_hora >= @de
        AND data_hora < @ate
      ORDER BY data_hora
    `),

    inserirSlot: db.prepare(
      `INSERT OR IGNORE INTO agenda (data_hora, status) VALUES (?, 'livre')`
    ),

    apagarSlotsPassados: db.prepare(`
      DELETE FROM agenda
      WHERE status = 'livre' AND data_hora < @ate
    `),

    getSlotLivre: db.prepare(
      `SELECT * FROM agenda WHERE data_hora = ? AND status = 'livre'`
    ),

    reservarSlot: db.prepare(`
      UPDATE agenda
      SET status = 'agendado',
          cliente_telefone = @telefone,
          cliente_nome = @nome,
          motivo = @motivo,
          atualizado_em = datetime('now', 'localtime')
      WHERE id = @id
    `),

    agendamentosDoCliente: db.prepare(`
      SELECT * FROM agenda
      WHERE cliente_telefone = ? AND status IN ('agendado', 'confirmada')
      ORDER BY data_hora
    `),

    atualizarResumoAgenda: db.prepare(`
      UPDATE agenda
      SET resumo = @resumo, atualizado_em = datetime('now', 'localtime')
      WHERE cliente_telefone = @telefone AND status = 'agendado'
    `),

    listarServicos: db.prepare(`
      SELECT id, nome, descricao, preco, ativo, ordem
      FROM servicos
      WHERE ativo = 1
      ORDER BY ordem, nome
    `),
  };

  return {
    getCliente(telefone) {
      return stmts.getCliente.get(telefone) || null;
    },

    upsertCliente({ telefone, nome = null }) {
      stmts.upsertCliente.run({ telefone, nome });
      return this.getCliente(telefone);
    },

    atualizarResumo({ telefone, resumo }) {
      stmts.atualizarResumo.run({ telefone, resumo });
    },

    tocarUltimaInteracao(telefone) {
      stmts.tocarInteracao.run(telefone);
    },

    // --- Agenda ---

    inserirSlot(dataHora) {
      stmts.inserirSlot.run(dataHora);
    },

    // Apaga slots livres que já passaram (mantém agendados/confirmados).
    apagarSlotsPassados(ate) {
      return stmts.apagarSlotsPassados.run({ ate }).changes;
    },

    listarDisponiveis({ de, ate }) {
      return stmts.slotsNoIntervalo.all({ de, ate });
    },

    agendarSlot({ dataHora, telefone, nome = null, motivo = null }) {
      const getCliente = stmts.getCliente.get.bind(stmts.getCliente);
      const upsertCliente = stmts.upsertCliente.run.bind(stmts.upsertCliente);

      return db.transaction(() => {
        const slot = stmts.getSlotLivre.get(dataHora);
        if (!slot) return { ok: false, motivo: 'horario_indisponivel' };

        stmts.reservarSlot.run({ id: slot.id, telefone, nome, motivo });
        if (!getCliente(telefone)) upsertCliente({ telefone, nome });
        return { ok: true, slot: { id: slot.id, data_hora: slot.data_hora } };
      })();
    },

    agendamentosDoCliente(telefone) {
      return stmts.agendamentosDoCliente.all(telefone);
    },

    atualizarResumoDaAgenda({ telefone, resumo }) {
      return stmts.atualizarResumoAgenda.run({ telefone, resumo }).changes;
    },

    // --- Serviços ---

    listarServicosAtivos() {
      return stmts.listarServicos.all();
    },
  };
}