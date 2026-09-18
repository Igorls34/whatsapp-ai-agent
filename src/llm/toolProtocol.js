// Protocolo de function calling via texto.
//
// O opencode (local) atua como "cérebro" do agente, mas as ferramentas de negócio
// (consultar_disponibilidade, agendar_reuniao, ...) são implementadas neste processo
// (Node + SQLite). Para o modelo conseguir chamá-las sem depender de tools nativos do
// endpoint, o system prompt instrui a responder com um envelope JSON quando uma
// ferramenta for necessária:
//
//   ===TOOL===
//   {"name":"agendar_reuniao","arguments":{"data_hora":"2026-09-15T14:00", ...}}
//   ===END===
//
// O agente executa a ferramenta localmente e devolve o resultado JSON como nova
// mensagem, repetindo o ciclo. Envelope via texto funciona com QUALQUER modelo
// chat (big-pickle incluso) e mantém tudo dentro do processo do agente.

export const TOOL_BEGIN = '===TOOL===';
export const TOOL_END = '===END===';

export const TOOL_PROTOCOL_INSTRUCTIONS = `
## 5. Protocolo de Ferramentas (IMPORTANTE)
Você tem acesso a ferramentas executadas fora do seu runtime. Para usá-las, responda SOMENTE com o envelope JSON abaixo (sem texto extra, sem markdown):

${TOOL_BEGIN}
{"name":"nome_da_ferramenta","arguments":{ ...argumentos... }}
${TOOL_END}

Ferramentas disponíveis:
- consultar_disponibilidade  — argumentos: { "dias"?: n }
- agendar_reuniao            — argumentos: { "data_hora": "AAAA-MM-DDTHH:MM", "telefone": "...", "nome"?: "...", "motivo"?: "..." }
- salvar_resumo_cliente      — argumentos: { "telefone": "...", "resumo": "..." }
- notificar_emergencia       — argumentos: { "telefone": "...", "nome"?: "...", "mensagem": "..." }
- enviar_imagem              — argumentos: { "telefone": "...", "imagem": "apelido_da_imagem_do_manifest", "legenda"?: "..." } — envia imagem OU gif (depende do arquivo cadastrado)

Regras:
- O envio de data_hora deve usar EXATAMENTE o formato retornado por consultar_disponibilidade (ex: 2026-09-15T14:00).
- Faça UMA chamada por vez: só envie outra ferramenta ou o texto final depois de receber o resultado desta.
- Quando não precisar de ferramenta, responda normalmente em texto curto.
`.trim();

export const TOOL_PROTOCOL_SYSTEM_START = '## 5. Uso das Ferramentas';

// Extrai o primeiro objeto JSON balanceado {...} de um texto, ignorando prosa.
function extrairJsonBalanceado(candidato) {
  let str = String(candidato || '').trim();
  str = str.replace(/^```(?:json)?/i, '').replace(/\s*```\s*$/g, '').trim();
  const inicio = str.indexOf('{');
  if (inicio === -1) return str;
  let depth = 0;
  let emString = false;
  for (let i = inicio; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' && str[i - 1] !== '\\') emString = !emString;
    if (emString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return str.slice(inicio, i + 1);
    }
  }
  return str.slice(inicio);
}

export function parseToolEnvelope(text) {
  if (!text) return null;

  const quoted = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const begin = quoted(TOOL_BEGIN);
  const end = quoted(TOOL_END);

  // Formato canônico: ===TOOL=== ... ===END=== (ignora prosa antes/depois).
  const completo = text.match(new RegExp(`${begin}\\s*([\\s\\S]*?)\\s*${end}`, 'i'));
  // Tolerância: marcador de início sem ===END=== (modelo "esquece" de fechar).
  const semFim = !completo && text.match(new RegExp(`${begin}\\s*([\\s\\S]*)$`, 'i'));
  // Bloco de código com JSON (modelo usa markdown mesmo quando não é pra usar).
  const fence = !completo && !semFim && text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

  for (const grupo of [completo, semFim, fence]) {
    if (!grupo) continue;
    try {
      const parsed = JSON.parse(extrairJsonBalanceado(grupo[1]));
      if (parsed && typeof parsed === 'object' && parsed.name) {
        return {
          name: parsed.name,
          arguments: parsed.arguments && typeof parsed.arguments === 'object' ? parsed.arguments : {},
        };
      }
    } catch (err) {
      // não é JSON válido: tenta o próximo candidato
    }
  }
  return null;
}

export function buildToolResultMessage(name, result) {
  return `[Resultado da ferramenta "${name}"]\n${JSON.stringify(result)}`;
}

// Anexa o protocolo ao system prompt caso ainda não esteja lá.
export function withToolProtocol(system) {
  return system.includes(TOOL_PROTOCOL_INSTRUCTIONS)
    ? system
    : `${system}\n\n${TOOL_PROTOCOL_INSTRUCTIONS}`;
}