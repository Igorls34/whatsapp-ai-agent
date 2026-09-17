import 'dotenv/config';
import { config } from './config.js';
import { openDatabase } from './db/database.js';
import { createRepositories } from './db/repositories.js';
import { createConversationMemory } from './memory/conversationMemory.js';
import { createLocalOpencodeAdapter } from './llm/localOpencodeAdapter.js';
import { createAgent } from './llm/agent.js';
import { createSummarizer } from './llm/summarizer.js';
import { createToolExecutor } from './services/toolExecutor.js';
import { createImageService } from './services/imageService.js';
import { gerarSlots, limparSlotsPassados } from './db/autoSeed.js';
import { createMessageHandler } from './whatsapp/messageHandler.js';
import { connectWhatsApp } from './whatsapp/client.js';
import { createSendPacer } from './services/backpressure.js';

function main() {
  const db = openDatabase(config.dbPath);
  const repos = createRepositories(db);

  // Auto-seed: gera slots livres no startup e a cada 12h; apaga slots passados
  const limparEAseedar = () => {
    const removidos = limparSlotsPassados(repos);
    if (removidos) console.log(`[seed] ${removidos} slots de ontem/anteriores apagados.`);
    const criados = gerarSlots(repos);
    if (criados) console.log(`[seed] ${criados} horários livres gerados/atualizados.`);
  };
  limparEAseedar();
  setInterval(limparEAseedar, 12 * 60 * 60 * 1000);

  const memory = createConversationMemory({
    keepMessages: config.memory.keepMessages,
    summarizeEvery: config.memory.summarizeEvery,
  });

  let socketRef = null;
  const getSocket = () => socketRef;

  // Ponte tools <-> banco
  const executor = createToolExecutor({ repos, getSocket, config });

  // IA: opencode local (opencode serve)
  const adapter = createLocalOpencodeAdapter();

  adapter
    .health()
    .then(({ version }) => {
      console.log(`[llm] opencode server OK (v${version}). Modelo: ${config.llm.opencode.model || 'default da máquina'}`);
    })
    .catch((err) => {
      console.warn(`[llm] ${err.message}`);
      console.warn('[llm] O bot seguirá no ar, mas responderá com aviso. Rode em outro terminal: opencode serve --port 4096');
    });

  const agent = createAgent({ adapter, executor });
  const summarizer = createSummarizer({ adapter });
  const imageService = createImageService({ getSocket, config });

  // Entrega avisos enfileirados por processos sem WhatsApp (chat web/painel):
  // agendamentos, emergências etc. Verifica a cada 30s. Cada aviso é tratado
  // individualmente: um erro em um deles não bloqueia os demais (sem
  // cabeça-de-linha); após 5 tentativas sem sucesso o aviso é descartado.
  const pacer = createSendPacer({ minGapMs: config.limites.envioMinGapMs });
  const tentativasAviso = new Map();
  const MAX_TENTATIVAS_AVISO = 5;

  const drenarAvisosPendentes = async () => {
    const socket = getSocket();
    const numero = config.notificacoes?.whatsapp;
    if (!socket || !numero) return;
    for (const aviso of repos.listarAvisosPendentes()) {
      try {
        await pacer.run(() => socket.sendMessage(`${numero}@s.whatsapp.net`, { text: aviso.texto }));
        repos.removerAviso(aviso.id);
        tentativasAviso.delete(aviso.id);
        console.log(`[notif] aviso entregue via WhatsApp: ${aviso.texto.slice(0, 90)}`);
      } catch (err) {
        const atual = (tentativasAviso.get(aviso.id) || 0) + 1;
        const msg = String(err?.message || err).slice(0, 150);
        if (atual >= MAX_TENTATIVAS_AVISO) {
          tentativasAviso.delete(aviso.id);
          repos.removerAviso(aviso.id);
          console.error(`[notif] aviso ${aviso.id} removido após ${atual} tentativas sem sucesso: ${msg}`);
        } else {
          tentativasAviso.set(aviso.id, atual);
          console.error(`[notif] aviso ${aviso.id} falhou (${atual}/${MAX_TENTATIVAS_AVISO}), mantido: ${msg}`);
        }
      }
    }
  };
  setInterval(drenarAvisosPendentes, 30 * 1000);

  const onMessage = createMessageHandler({
    repos,
    getSocket,
    agent,
    summarizer,
    memory,
    imageService,
    config,
    pacer,
  });

  connectWhatsApp({
    onMessage,
    onSocket: (socket) => { socketRef = socket; },
  })
    .catch((err) => {
      console.error('[whatsapp] falha ao iniciar:', err);
      process.exit(1);
    });
}

main();