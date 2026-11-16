import 'dotenv/config';
import { config } from './config.js';
import { createBrain } from './core/brain.js';
import { createConversationService } from './conversation/service.js';
import { criarRouterPadrao, criarServidorHttp } from './http/server.js';
import { createQrState } from './whatsapp/qrState.js';
import { gerarSlots, limparSlotsPassados } from './db/autoSeed.js';
import { createMessageHandler } from './whatsapp/messageHandler.js';
import { connectWhatsApp } from './whatsapp/client.js';
import { createSendPacer } from './services/backpressure.js';

// Aplicação única: um cérebro, um banco, um servidor HTTP e o WhatsApp — tudo
// no mesmo processo. `src/index.js` chama `criarAplicacao().iniciar()`.
export function criarAplicacao({ config: cfg = config } = {}) {
  const brain = createBrain({ config: cfg });
  const { repos, memory, imageService } = brain;
  const conversation = createConversationService({ brain, config: cfg });
  const qrState = createQrState();

  // Avisos gerados por canais/rotas: com socket, o notifier envia direto; sem
  // socket (ex.: antes do pareamento), ficam na fila do banco para o dreno.
  const enfileirarAviso = (texto) => {
    try {
      return repos.enfileirarAviso(texto);
    } catch (err) {
      console.error('[notif] falha ao enfileirar aviso:', err.message);
      return undefined;
    }
  };

  const canalWhatsApp = brain.createChannel({ canal: 'whatsapp', dbEnqueue: enfileirarAviso });
  const canalWeb = brain.createChannel({ canal: 'web', dbEnqueue: enfileirarAviso });

  const router = criarRouterPadrao({
    config: cfg,
    brain,
    repos,
    memory,
    webAgent: canalWeb.agent,
    conversation,
    qrState,
  });
  const servidor = criarServidorHttp({ router });

  const pacer = createSendPacer({ minGapMs: cfg.limites.envioMinGapMs });

  const onMessage = createMessageHandler({
    repos,
    getSocket: brain.getSocket,
    agent: canalWhatsApp.agent,
    memory,
    imageService,
    config: cfg,
    pacer,
    conversation,
  });

  // ---------------------------------------------------------------------------
  // Agendadores em processo
  // ---------------------------------------------------------------------------
  const timers = [];
  let servidorAberto = false;
  let ultimaLimpeza = 0;

  const limparEAseedar = () => {
    try {
      const removidos = limparSlotsPassados(repos);
      if (removidos) console.log(`[seed] ${removidos} slots de ontem/anteriores apagados.`);
      const criados = gerarSlots(repos);
      if (criados) console.log(`[seed] ${criados} horários livres gerados/atualizados.`);
    } catch (err) {
      console.error('[seed] falha ao gerar/limpar slots:', err.message);
    }
  };

  // Entrega avisos enfileirados quando não havia socket do WhatsApp. Cada aviso
  // é tratado individualmente: um erro não bloqueia os demais; após 5
  // tentativas sem sucesso o aviso é descartado.
  const tentativasAviso = new Map();
  const MAX_TENTATIVAS_AVISO = 5;

  const drenarAvisosPendentes = async () => {
    const socket = brain.getSocket();
    const numero = cfg.notificacoes?.whatsapp;
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

  // ---------------------------------------------------------------------------
  // Ciclo de vida
  // ---------------------------------------------------------------------------
  async function iniciar() {
    await new Promise((resolve, reject) => {
      const aoFalhar = (err) => reject(err);
      servidor.once('error', aoFalhar);
      servidor.listen(cfg.http.port, cfg.http.host, () => {
        servidor.off('error', aoFalhar);
        resolve();
      });
    });
    servidorAberto = true;
    console.log(
      `[app] Sistema no ar em http://${cfg.http.host}:${cfg.http.port}` +
        ' — chat / · painel /admin · QR /qr · health /health'
    );

    // Auto-seed: no boot e a cada 12h.
    limparEAseedar();
    ultimaLimpeza = Date.now();
    timers.push(
      setInterval(() => {
        limparEAseedar();
        ultimaLimpeza = Date.now();
      }, 12 * 60 * 60 * 1000)
    );

    brain.adapter
      .health()
      .then(({ version }) => {
        console.log(
          `[llm] opencode server OK (v${version}). Modelo: ${cfg.llm.opencode.model || 'default da máquina'}`
        );
      })
      .catch((err) => {
        console.warn(`[llm] ${err.message}`);
        console.warn('[llm] O bot seguirá no ar, mas responderá com aviso. Rode em outro terminal: opencode serve --port 4096');
      });

    timers.push(setInterval(drenarAvisosPendentes, 30 * 1000));

    // WhatsApp: QR vai para /qr; status alimenta /health.
    connectWhatsApp({
      onMessage,
      onSocket: (socket) => brain.setSocket(socket),
      onQr: (qr) => {
        if (qr) qrState.definirQr(qr);
        else qrState.limparQr();
      },
      onStatus: (status) => {
        if (status === 'open') qrState.conectar();
        else qrState.desconectar();
      },
    }).catch((err) => {
      console.error('[whatsapp] falha ao iniciar:', err);
      process.exit(1);
    });

    return servidor;
  }

  async function parar() {
    for (const timer of timers) clearInterval(timer);
    timers.length = 0;
    if (servidorAberto) {
      await new Promise((resolve) => servidor.close(() => resolve()));
      servidorAberto = false;
    }
    try {
      brain.db.close();
    } catch (err) {
      /* já fechado */
    }
  }

  return {
    brain,
    conversation,
    qrState,
    servidor,
    router,
    canais: { whatsapp: canalWhatsApp, web: canalWeb },
    iniciar,
    parar,
    info: () => ({ ultimaLimpeza }),
  };
}
