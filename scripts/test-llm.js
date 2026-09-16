import 'dotenv/config';
import { createLocalOpencodeAdapter } from '../src/llm/localOpencodeAdapter.js';
import { withToolProtocol, parseToolEnvelope } from '../src/llm/toolProtocol.js';
import { systemPrompt } from '../src/prompt/systemPrompt.js';

// Smoke test da IA (opencode local):
// 1. Checa a saúde do servidor
// 2. Manda um "Olá" e verifica que o big-pickle responde
// 3. Testa o parser do protocolo de ferramentas

const adapter = createLocalOpencodeAdapter();

try {
  const { version } = await adapter.health();
  console.log(`✅ opencode server OK (v${version})`);
} catch (err) {
  console.error('❌ ' + err.message);
  console.error('   Rode antes, em outro terminal:  opencode serve --port 4096');
  process.exit(1);
}

const reply = await adapter.complete({
  system: withToolProtocol(systemPrompt),
  text: 'Olá! Estou testando o agente do Igor. Apenas confirme que recebeu esta mensagem.',
  title: 'whatsapp-agent:smoke',
});
console.log('🤖 Resposta do modelo:');
console.log(reply || '(vazia)');
if (!reply) {
  console.error('❌ modelo não respondeu');
  process.exit(1);
}

const envelope = {
  name: 'agendar_reuniao',
  arguments: { data_hora: '2026-09-15T14:00', telefone: '5511999999999' },
};
const parse = parseToolEnvelope(
  `===TOOL===\n${JSON.stringify(envelope)}\n===END===`
);
console.log('🔧 Teste do parser de ferramenta:', JSON.stringify(parse));

if (!parse || parse.name !== 'agendar_reuniao') {
  console.error('❌ parser do protocolo de ferramentas falhou');
  process.exit(1);
}
console.log('✅ Parser do protocolo de ferramentas OK');
console.log('\n🎉 IA conectada e funcionando.');