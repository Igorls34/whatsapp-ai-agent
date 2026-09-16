import { systemPrompt } from '../prompt/systemPrompt.js';
import {
  withToolProtocol,
  parseToolEnvelope,
  buildToolResultMessage,
} from './toolProtocol.js';

const MAX_ROUNDS = 6;

// Agente que usa o adapter (opencode local) como cérebro e executa as
// ferramentas de negócio neste processo via protocolo de texto (===TOOL===).
// Monta a seção de catálogo de serviços para o system prompt.
// Baseia-se SOMENTE no que veio do banco (lista editável manualmente).
export function buildServiceCatalog(servicos = []) {
  if (!servicos.length) {
    return (
      '## Catálogo de Serviços do Igor\n' +
      '(catálogo vazio — apresente o Igor sob demanda: desenvolvimento de software, sistemas ' +
      'e automações, mas SEM listar serviços específicos até o Igor preencher.)'
    );
  }
  const linhas = servicos
    .map((s) => {
      const partes = [`- ${s.nome}`, s.descricao ? `: ${s.descricao}` : ''];
      if (s.preco) partes.push(` (${s.preco})`);
      return partes.join('');
    })
    .join('\n');
  return `## Catálogo de Serviços do Igor\n${linhas}`;
}

export function buildImageCatalog(imagens = []) {
  if (!imagens.length) return '';
  const linhas = imagens
    .map((img) => `- ${img.apelido}${img.descricao ? ` — ${img.descricao}` : ''}`)
    .join('\n');
  return `## Imagens disponíveis para enviar ao cliente\n${linhas}`;
}

export function createAgent({ adapter, executor }) {
  const baseSystem = withToolProtocol(systemPrompt);

  // Aceita tanto executor.execute(...) quanto uma função direta.
  const runTool =
    typeof executor === 'function' ? executor : (name, args) => executor.execute(name, args);

  async function run({ telefone, resumo, mensagem, servicos, imagens }) {
    // Memória de longo prazo: resumo persistido do cliente injetado no system prompt.
    const catalogo = buildServiceCatalog(servicos);
    const imagensDisponiveis = buildImageCatalog(imagens);
    const extras = [catalogo, imagensDisponiveis].filter(Boolean).join('\n\n');
    const system = resumo
      ? `${baseSystem}\n\n# Contexto persistente do cliente\n${resumo}\n\n${extras}`
      : `${baseSystem}\n\n${extras}`;

    let turno = mensagem;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const reply = await adapter.runTurn({ sessionKey: telefone, system, text: turno });

      if (!reply || !reply.trim()) {
        return 'Estou sem resposta no momento 😅. Quer que eu chame o Igor pra te atender?';
      }

      const call = parseToolEnvelope(reply);

      // Sem envelope de ferramenta: é a resposta final.
      if (!call) return reply;

      // Executa a ferramenta localmente e realimenta o modelo com o resultado.
      const result = await runTool(call.name, { ...call.arguments, telefone });
      turno = `${buildToolResultMessage(call.name, result)}\n\nContinue, por favor.`;
    }

    return 'Parece que não consegui concluir isso agora 😅. Quer que eu chame o Igor pra te atender?';
  }

  return { run };
}