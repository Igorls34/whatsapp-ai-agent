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

    // --- Controle de chat (bloqueio por abuso) ---

    liberarBloqueio: db.prepare(`
      UPDATE clientes
      SET chat_fechado = 0,
          motivo_bloqueio = NULL,
          bloqueado_em = NULL,
          desbloqueio_em = NULL,
          atualizado_em = datetime('now', 'localtime')
      WHERE telefone = ?
    `),

    fecharChat: db.prepare(`
      UPDATE clientes
      SET chat_fechado = 1,
          motivo_bloqueio = @motivo,
          bloqueado_em = datetime('now', 'localtime'),
          desbloqueio_em = CASE
            WHEN @horas IS NULL THEN NULL
            ELSE datetime('now', 'localtime', '+' || @horas || ' hours')
          END,
          atualizado_em = datetime('now', 'localtime')
      WHERE telefone = @telefone
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
      SELECT id, nome, descricao, categoria, ativo, ordem
      FROM servicos
      WHERE ativo = 1
      ORDER BY ordem, nome
    `),

    listarCategorias: db.prepare(`
      SELECT DISTINCT categoria FROM servicos
      WHERE ativo = 1 AND categoria != ''
      ORDER BY categoria
    `),

    // --- Painel admin (CRUD): todos os serviços, inclusive inativos ---

    listarServicosAdmin: db.prepare(`
      SELECT id, nome, descricao, categoria, ativo, ordem, criado_em, atualizado_em
      FROM servicos
      ORDER BY ordem, nome
    `),

    getServico: db.prepare(`
      SELECT id, nome, descricao, categoria, ativo, ordem
      FROM servicos
      WHERE id = ?
    `),

    inserirServico: db.prepare(`
      INSERT INTO servicos (nome, descricao, categoria, ativo, ordem)
      VALUES (@nome, @descricao, @categoria, @ativo, @ordem)
    `),

    atualizarServico: db.prepare(`
      UPDATE servicos
      SET nome = @nome,
          descricao = @descricao,
          categoria = @categoria,
          ativo = @ativo,
          ordem = @ordem,
          atualizado_em = datetime('now', 'localtime')
      WHERE id = @id
    `),

    excluirServico: db.prepare(`DELETE FROM servicos WHERE id = ?`),

    // --- Fila de avisos pendentes (web/outros processos -> bot) ---

    listarAvisosPendentes: db.prepare(`
      SELECT id, texto, criado_em FROM avisos_pendentes ORDER BY id LIMIT 25
    `),

    enfileirarAviso: db.prepare(
      `INSERT INTO avisos_pendentes (texto) VALUES (?)`
    ),

    removerAviso: db.prepare(`DELETE FROM avisos_pendentes WHERE id = ?`),

    // --- Agenda (CRUD admin) ---

    getAgendamento: db.prepare(`
      SELECT a.id, a.data_hora, a.status, a.cliente_telefone, a.cliente_nome,
             a.motivo, a.resumo, c.resumo AS cliente_resumo
      FROM agenda a LEFT JOIN clientes c ON c.telefone = a.cliente_telefone
      WHERE a.id = ?
    `),

    getPorDataHora: db.prepare(`SELECT id, status FROM agenda WHERE data_hora = ?`),

    inserirAgenda: db.prepare(`
      INSERT INTO agenda (data_hora, status, cliente_telefone, cliente_nome, motivo)
      VALUES (@data_hora, @status, @cliente_telefone, @cliente_nome, @motivo)
    `),

    atualizarAgendamento: db.prepare(`
      UPDATE agenda
      SET data_hora = @data_hora,
          status = @status,
          cliente_telefone = @cliente_telefone,
          cliente_nome = @cliente_nome,
          motivo = @motivo,
          atualizado_em = datetime('now', 'localtime')
      WHERE id = @id
    `),

    excluirAgendamento: db.prepare(`DELETE FROM agenda WHERE id = ?`),

    // --- Painel admin: dashboard e gestão de clientes ---

    dashboardCnt: db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM clientes)                                    AS clientes,
        (SELECT COUNT(*) FROM clientes WHERE chat_fechado = 1)              AS bloqueados,
        (SELECT COUNT(*) FROM servicos)                                     AS servicos,
        (SELECT COUNT(*) FROM servicos WHERE ativo = 1)                     AS servicos_ativos,
        (SELECT COUNT(*) FROM avisos_pendentes)                             AS avisos_pendentes
    `),

    dashboardAgendaFutura: db.prepare(`
      SELECT status, COUNT(*) AS total
      FROM agenda
      WHERE data_hora >= @agora
      GROUP BY status
    `),

    proximosAgendamentos: db.prepare(`
      SELECT a.id, a.data_hora, a.status, a.cliente_telefone, a.cliente_nome, a.motivo
      FROM agenda a
      WHERE a.status IN ('agendado', 'confirmada') AND a.data_hora >= @agora
      ORDER BY a.data_hora ASC, a.id ASC
      LIMIT @limite
    `),

    listarClientes: db.prepare(`
      SELECT telefone, nome, resumo, ultima_interacao_at, criado_em, atualizado_em,
             chat_fechado, motivo_bloqueio, bloqueado_em, desbloqueio_em
      FROM clientes
      WHERE (@q = '' OR nome LIKE @q OR telefone LIKE @q)
      ORDER BY (ultima_interacao_at IS NULL), ultima_interacao_at DESC, id DESC
      LIMIT @limite
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

    // --- Controle de chat (bloqueio por abuso) ---

    // Estado de bloqueio no momento: resolve expiração de bloqueio temporário.
    // Retorna { bloqueado, motivo, temporario, desbloqueio_em, bloqueado_em }.
    estadoChat(telefone) {
      const c = stmts.getCliente.get(telefone);
      if (!c?.chat_fechado) return { bloqueado: false, temporario: false, motivo: null };
      const expira = c.desbloqueio_em;
      if (expira) {
        const t = Date.parse(String(expira).replace(' ', 'T'));
        if (Number.isNaN(t) || Date.now() >= t) {
          stmts.liberarBloqueio.run(telefone);
          return { bloqueado: false, temporario: true, motivo: null };
        }
      }
      return {
        bloqueado: true,
        motivo: c.motivo_bloqueio,
        temporario: Boolean(expira),
        desbloqueio_em: expira,
        bloqueado_em: c.bloqueado_em,
      };
    },

    // Fecha o chat: horas = null -> permanente (WhatsApp); horas = n -> temporário (web).
    fecharChat({ telefone, motivo, horas = null }) {
      const r = stmts.fecharChat.run({ telefone, motivo, horas });
      return {
        ok: r.changes > 0,
        temporario: Boolean(horas),
        horas,
      };
    },

    liberarChat(telefone) {
      stmts.liberarBloqueio.run(telefone);
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

    // --- Serviços (painel admin) ---

    listarServicosAdmin() {
      return stmts.listarServicosAdmin.all();
    },

    listarCategorias() {
      return stmts.listarCategorias.all().map((r) => r.categoria);
    },

    criarServico({ nome, descricao = '', categoria = '', ativo = 1, ordem = 0 }) {
      const info = stmts.inserirServico.run({ nome, descricao, categoria, ativo, ordem });
      return stmts.getServico.get(info.lastInsertRowid) || null;
    },

    atualizarServico({ id, nome, descricao, categoria, ativo, ordem }) {
      const info = stmts.atualizarServico.run({ id, nome, descricao, categoria, ativo, ordem });
      return info.changes ? stmts.getServico.get(id) || null : null;
    },

    excluirServico(id) {
      return stmts.excluirServico.run(id).changes > 0;
    },

    // --- Fila de avisos pendentes ---

    listarAvisosPendentes() {
      return stmts.listarAvisosPendentes.all();
    },

    enfileirarAviso(texto) {
      stmts.enfileirarAviso.run(texto);
    },

    removerAviso(id) {
      stmts.removerAviso.run(id);
    },

    // --- Agenda (CRUD admin) ---

    listarAgenda({ status = 'todos', de = null, ate = null } = {}) {
      const conds = [];
      const params = {};
      if (status && status !== 'todos') {
        conds.push('a.status = @status');
        params.status = status;
      }
      if (de) {
        conds.push('a.data_hora >= @de');
        params.de = de;
      }
      if (ate) {
        conds.push('a.data_hora < @ate');
        params.ate = ate;
      }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      return db
        .prepare(`
          SELECT a.id, a.data_hora, a.status, a.cliente_telefone, a.cliente_nome,
                 a.motivo, a.resumo, c.resumo AS cliente_resumo
          FROM agenda a LEFT JOIN clientes c ON c.telefone = a.cliente_telefone
          ${where}
          ORDER BY CASE a.status WHEN 'agendado' THEN 0 WHEN 'confirmada' THEN 1
                   WHEN 'cancelada' THEN 2 WHEN 'livre' THEN 3 ELSE 4 END,
                   a.data_hora ASC, a.id ASC
        `)
        .all(params);
    },

    getAgendamento(id) {
      return stmts.getAgendamento.get(id) || null;
    },

    criarAgendamento({ data_hora, status = 'livre', cliente_telefone = null, cliente_nome = null, motivo = null }) {
      const getCliente = stmts.getCliente.get.bind(stmts.getCliente);
      const upsertCliente = stmts.upsertCliente.run.bind(stmts.upsertCliente);
      return db.transaction(() => {
        const existente = stmts.getPorDataHora.get(data_hora);
        if (existente) {
          if (existente.status !== 'livre') return { ok: false, motivo: 'horario_ocupado' };
          if (status === 'livre') return { ok: true, id: existente.id };
          stmts.reservarSlot.run({
            id: existente.id,
            telefone: cliente_telefone || 'manual',
            nome: cliente_nome,
            motivo,
          });
          if (cliente_telefone && !getCliente(cliente_telefone)) upsertCliente({ telefone: cliente_telefone, nome: cliente_nome });
          return { ok: true, id: existente.id };
        }
        const info = stmts.inserirAgenda.run({
          data_hora,
          status,
          cliente_telefone: status === 'livre' ? null : cliente_telefone || 'manual',
          cliente_nome: status === 'livre' ? null : cliente_nome,
          motivo,
        });
        const id = info.lastInsertRowid;
        if (status !== 'livre' && cliente_telefone && !getCliente(cliente_telefone)) {
          upsertCliente({ telefone: cliente_telefone, nome: cliente_nome });
        }
        return { ok: true, id };
      })();
    },

    atualizarAgendamento({ id, data_hora, status = 'agendado', cliente_telefone = null, cliente_nome = null, motivo = null }) {
      const getCliente = stmts.getCliente.get.bind(stmts.getCliente);
      const upsertCliente = stmts.upsertCliente.run.bind(stmts.upsertCliente);
      return db.transaction(() => {
        const atual = stmts.getAgendamento.get(id);
        if (!atual) return { ok: false, motivo: 'nao_encontrado' };
        const ocupado = stmts.getPorDataHora.get(data_hora);
        if (ocupado && ocupado.id !== id) return { ok: false, motivo: 'horario_ocupado' };

        let telefone = cliente_telefone;
        let nome = cliente_nome;
        if (status === 'livre') {
          telefone = null;
          nome = null;
        } else if (!telefone) {
          telefone = atual.cliente_telefone || 'manual';
          nome = nome || atual.cliente_nome;
        }
        if (status !== 'livre' && telefone && !getCliente(telefone)) {
          upsertCliente({ telefone, nome });
        }
        stmts.atualizarAgendamento.run({ id, data_hora, status, cliente_telefone: telefone, cliente_nome: nome, motivo });
        return { ok: true, id };
      })();
    },

    excluirAgendamento(id) {
      return stmts.excluirAgendamento.run(id).changes > 0;
    },

    // --- Painel admin: dashboard e gestão de clientes ---

    obterResumoPainel() {
      const item = (r) => Number(r?.total ?? 0);
      const agora = toLocalIso(new Date());
      const agendaFutura = {};
      for (const r of stmts.dashboardAgendaFutura.all({ agora })) {
        agendaFutura[r.status] = item(r);
      }
      const c = stmts.dashboardCnt.get();
      return {
        clientes: c.clientes,
        bloqueados: c.bloqueados,
        servicos: c.servicos,
        servicosAtivos: c.servicos_ativos,
        avisosPendentes: c.avisos_pendentes,
        agendaFutura,
        proximos: stmts.proximosAgendamentos.all({ agora, limite: 8 }),
      };
    },

    listarClientes({ q = '', limite = 100 } = {}) {
      const termo = String(q || '').trim().slice(0, 80);
      return stmts.listarClientes.all({ q: `%${termo}%`, limite });
    },

    atenderCliente(telefone) {
      const c = stmts.getCliente.get(telefone);
      if (!c?.chat_fechado) return { ok: false, motivo: 'ja_aberto' };
      stmts.liberarBloqueio.run(telefone);
      return { ok: true };
    },
  };
}