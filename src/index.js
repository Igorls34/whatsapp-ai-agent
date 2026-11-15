import 'dotenv/config';
import { config } from './config.js';
import { createBrain } from './core/brain.js';
import { createConversationService } from './conversation/service.js';
import { gerarSlots, limparSlotsPassados } from './db/autoSeed.js';
import { createMessageHandler } from './whatsapp/messageHandler.js';
import { connectWhatsApp } from './whatsapp/client.js';
import { createSendPacer } from './services/backpressure.js';

function main() {
  // Cérebro compartilhado: banco, repositórios, memória, adapter, summarizer e
  // imageService são montados UMA vez aqui (e não duplicados por processo).
  const brain = createBrain({ config });
  const { repos, memory, imageService } = brain;

  const conversation = createConversationService({ brain, config });

  // Canal WhatsApp: par executor+agent com regras de 'whatsapp'.
  const { agent } = brain.createChannel({ canal: 'whatsapp' });

  // Auto-seed: gera slots livres no startup e a cada 12h; apaga slots passados
  const limparEAseedar = () => {
    const removidos = limparSlotsPassados(repos);
    if (removidos) console.log(`[seed] ${removidos} slots de ontem/anteriores apagados.`);
    const criados = gerarSlots(repos);
    if (criados) console.log(`[seed] ${criados} horários livres gerados/atualizados.`);
  };
  limparEAseedar();
  setInterval(limparEAseedar, 12 * 60 * 60 * 1000);

  brain.adapter
    .health()
    .then(({ version }) => {
      console.log(`[llm] opencode server OK (v${version}). Modelo: ${config.llm.opencode.model || 'default da máquina'}`);
    })
    .catch((err) => {
      console.warn(`[llm] ${err.message}`);
      console.warn('[llm] O bot seguirá no ar, mas responderá com aviso. Rode em outro terminal: opencode serve --port 4096');
    });

  // Entrega avisos enfileirados por processos sem WhatsApp (chat web/painel):
  // agendamentos, emergências etc. Verifica a cada 30s. Cada aviso é tratado
  // individualmente: um erro em um deles não bloqueia os demais (sem
  // cabeça-de-linha); após 5 tentativas sem sucesso o aviso é descartado.
  const pacer = createSendPacer({ minGapMs: config.limites.envioMinGapMs });
  const tentativasAviso = new Map();
  const MAX_TENTATIVAS_AVISO = 5;

  const drenarAvisosPendentes = async () => {
    const socket = brain.getSocket();
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
    getSocket: brain.getSocket,
    agent,
    memory,
    imageService,
    config,
    pacer,
    conversation,
  });

  connectWhatsApp({
    onMessage,
    onSocket: (socket) => {
      brain.setSocket(socket);
    },
  }).catch((err) => {
    console.error('[whatsapp] falha ao iniciar:', err);
    process.exit(1);
  });
}

main();
