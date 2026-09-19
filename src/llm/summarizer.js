// Gera/atualiza o resumo persistente de um cliente no banco (memória de longo prazo),
// usando o mesmo adapter local (opencode) em uma sessão efêmera.
export function createSummarizer({ adapter }) {
  const SUMMARY_SYSTEM = [
    'Você mantém a memória persistente de clientes de um agente de atendimento do negócio (prestador de serviços de tecnologia).',
    'Escreva um resumo em português, em 3 a 6 frases, com: nome (se citado), contexto do projeto/serviço, assunto tratado, decisões e agendamentos.',
    'Evite inventar informações. Junte o resumo anterior com a nova interação.',
    'Responda somente com o resumo, sem formatação ou introdução.',
  ].join(' ');

  return {
    async summarize({ telefone, resumoAnterior, historico }) {
      const narrativa = historico
        .map((m) => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`)
        .join('\n');

      const user = [
        `Resumo anterior:\n${resumoAnterior || '(vazio)'}`,
        `Nova interação (telefone ${telefone}):\n${narrativa}`,
        'Novo resumo consolidado:',
      ].join('\n\n');

      return adapter.complete({
        system: SUMMARY_SYSTEM,
        text: user,
        title: 'whatsapp-agent:resumo',
      });
    },
  };
}