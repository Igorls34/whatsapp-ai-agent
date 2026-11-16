// Núcleo compartilhado do agente.
//
// Monta UMA vez o banco, os repositórios, a memória volátil, o adapter
// (opencode local), o summarizer, o imageService e a outbox de notificações.
// Cada canal (whatsapp, web, futuros) monta seu par executor+agent a partir
// deste cérebro, sem duplicar o setup — que antes era repetido em src/index.js,
// src/web/server.js e src/admin/server.js.
import { openDatabase } from '../db/database.js';
import { createRepositories } from '../db/repositories.js';
import { createConversationMemory } from '../memory/conversationMemory.js';
import { createLocalOpencodeAdapter } from '../llm/localOpencodeAdapter.js';
import { createAgent } from '../llm/agent.js';
import { createSummarizer } from '../llm/summarizer.js';
import { createToolExecutor } from '../services/toolExecutor.js';
import { createImageService } from '../services/imageService.js';
import { createSendPacer } from '../services/backpressure.js';
import { createOutbox } from '../notifications/outbox.js';

// Store: banco + repositórios (uma conexão SQLite). Usado pelo painel admin,
// que não precisa do restante do cérebro (adapter/agent/...).
export function createStore(config) {
  const db = openDatabase(config.dbPath);
  const repos = createRepositories(db);
  return { db, repos };
}

export function createBrain({ config }) {
  const { db, repos } = createStore(config);

  const memory = createConversationMemory({
    keepMessages: config.memory.keepMessages,
    summarizeEvery: config.memory.summarizeEvery,
  });

  const adapter = createLocalOpencodeAdapter();
  const summarizer = createSummarizer({ adapter });

  // O socket do WhatsApp é registrado pelo transport quando conecta. Canais sem
  // WhatsApp (web) mantêm socketRef = null e as ferramentas respondem com aviso.
  let socketRef = null;
  const ouvintesSocket = new Set();

  const imageService = createImageService({ getSocket: () => socketRef, config });

  // Pacer único do processo: serializa envios no WhatsApp (bot e notificações).
  const pacer = createSendPacer({ minGapMs: config.limites.envioMinGapMs });

  // Outbox única: notificações de agendamento e emergência, com persistência
  // para restart e drenagem no evento de conexão (sem polling).
  const outbox = createOutbox({
    repos,
    getSocket: () => socketRef,
    pacer,
    numeroPadrao: config.notificacoes?.whatsapp || '',
  });

  // Registra o socket do WhatsApp e avisa quem espera pela conexão (ex.: outbox).
  function setSocket(socket) {
    socketRef = socket;
    if (!socket) return;
    for (const ouvinte of ouvintesSocket) {
      try {
        ouvinte(socket);
      } catch (err) {
        console.error('[brain] ouvinte de socket falhou:', err.message);
      }
    }
  }

  // Assina o evento de conexão. Retorna a função para cancelar a assinatura.
  function onSocket(ouvinte) {
    ouvintesSocket.add(ouvinte);
    return () => ouvintesSocket.delete(ouvinte);
  }

  // Monta o par executor+agent para um canal. O `canal` ajusta regras por meio
  // (ex.: bloqueio permanente no WhatsApp vs temporário no web).
  function createChannel({ canal = 'whatsapp', getSocket = null } = {}) {
    const executor = createToolExecutor({
      repos,
      getSocket: getSocket || (() => socketRef),
      config,
      outbox,
      canal,
    });
    const agent = createAgent({ adapter, executor, canal });
    return { executor, agent };
  }

  return {
    db,
    repos,
    memory,
    adapter,
    summarizer,
    imageService,
    pacer,
    outbox,
    createChannel,
    health: () => adapter.health(),
    setSocket,
    getSocket: () => socketRef,
    onSocket,
  };
}
