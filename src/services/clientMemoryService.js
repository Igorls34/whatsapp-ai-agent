// Controle da memória persistente de cada cliente (tabela clientes + resumo em agendamentos)
export function createClientMemoryService(repos) {
  return {
    // Retorna o contexto PERSISTIDO do cliente para injetar na mensagem do LLM.
    async getContexto(telefone) {
      const cliente = repos.getCliente(telefone);
      if (!cliente) {
        return { telefone, nome: null, resumo: '', ja_atendeu: false };
      }
      return {
        telefone,
        nome: cliente.nome,
        resumo: cliente.resumo,
        ultima_interacao_at: cliente.ultima_interacao_at,
        ja_atendeu: Boolean(cliente.ultima_interacao_at || cliente.resumo),
      };
    },

    // salvar_resumo_cliente(telefone, resumo)
    async salvarResumo({ telefone, resumo }) {
      if (!telefone || !resumo) return { ok: false, motivo: 'dados_incompletos' };
      repos.atualizarResumo({ telefone, resumo });
      repos.atualizarResumoDaAgenda({ telefone, resumo });
      return { ok: true, resumo_salvo: true };
    },

    async registrarNome(telefone, nome) {
      if (!nome) return;
      repos.upsertCliente({ telefone, nome });
    },

    async tocarUltimaInteracao(telefone) {
      repos.tocarUltimaInteracao(telefone);
    },
  };
}