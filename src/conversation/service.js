// Orquestrador de turno AGNÓSTICO de canal.
//
// Concentra a parte do fluxo que é idêntica entre WhatsApp, chat web (e futuros
// canais): separar a resposta em múltiplas mensagens, rodar o agente com o
// catálogo + imagens, manter a memória de longo prazo e registrar a interação.
// Os transports (src/whatsapp/, src/web/) cuidam do que é específico de cada
// meio (boas-vindas, mídia, rate-limit, envio pelo socket).
//
// Recebe um `brain` (src/core/brain.js). Não tem imports com efeitos colaterais
// — é puro e testável.

export const MSG_SEPARATOR = '|||';

// Divide a resposta do agente em partes (mensagens separadas no WhatsApp/web).
export function separarPartes(reply) {
  return String(reply)
    .split(MSG_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function createConversationService({ brain, config }) {
  const { repos, memory, summarizer, imageService } = brain;

  // Roda o agente para uma mensagem, injetando o catálogo de serviços e as
  // imagens disponíveis (quando ativas). `agent` vem do canal (brain.createChannel).
  async function responderComAgente({ agent, id, resumo, mensagem }) {
    const servicos = repos.listarServicosAtivos();
    const imagens = config.imagens.ativo ? imageService.listar() : [];
    return agent.run({ telefone: id, resumo, mensagem, servicos, imagens });
  }

  // Atualiza o resumo persistente (memória de longo prazo) quando o contador
  // venceu. Retorna true se um novo resumo foi gravado.
  async function manterMemoria({ id, resumoAnterior }) {
    if (!memory.isSummaryDue(id)) return false;
    try {
      const novoResumo = await summarizer.summarize({
        telefone: id,
        resumoAnterior,
        historico: memory.history(id),
      });
      if (novoResumo) repos.atualizarResumo({ telefone: id, resumo: novoResumo });
      memory.resetSummaryCounter(id);
      console.log(`[memoria] resumo de ${id} atualizado`);
      return true;
    } catch (err) {
      console.error('[memoria] falha ao gerar resumo:', err);
      return false;
    }
  }

  // Registra a última interação do cliente (ignora banco offline).
  function tocarInteracao(id) {
    try {
      repos.tocarUltimaInteracao(id);
    } catch (err) {
      /* banco offline: ignore */
    }
  }

  return { separarPartes, responderComAgente, manterMemoria, tocarInteracao };
}
