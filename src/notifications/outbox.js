// Caixa de saída (outbox) das notificações do WhatsApp.
//
// Antes: cada notificação dependia de o processo ter o socket; quando não tinha
// (chat web/painel), gravava em `avisos_pendentes` e o bot drenava a fila em
// polling a cada 30s.
//
// Agora: todo aviso passa por `outbox.enviar()`. Com socket, envia na hora
// (respeitando o pacer). Sem socket — ou se o envio falhar — persiste na tabela
// (para sobreviver a restart) e drena assim que o socket conecta (evento do
// app), com retry exponencial enquanto houver pendências. Sem polling fixo.
export function createOutbox({
  repos,
  getSocket,
  pacer = null,
  numeroPadrao = '',
  logger = console,
  maxTentativas = 5,
  limiteLote = 25,
  retryBaseMs = 5_000,
  retryMaxMs = 5 * 60 * 1000,
} = {}) {
  const tentativas = new Map();
  let drenando = null;
  let timerRetry = null;
  let backoffMs = retryBaseMs;

  const log = (msg) => logger.log?.(`[notif] ${msg}`);
  const erro = (msg) => logger.error?.(`[notif] ${msg}`);

  function jid(telefone) {
    return `${String(telefone).trim()}@s.whatsapp.net`;
  }

  function enfileirar(texto, destino) {
    try {
      repos.enfileirarAviso(texto, destino || null);
      return true;
    } catch (err) {
      erro(`falha ao enfileirar aviso: ${err.message}`);
      return false;
    }
  }

  async function enviarAgora(socket, telefone, texto) {
    const run = () => socket.sendMessage(jid(telefone), { text: texto });
    if (pacer && typeof pacer.run === 'function') return pacer.run(run);
    return run();
  }

  function agendarRetry() {
    if (timerRetry) return;
    const espera = backoffMs;
    backoffMs = Math.min(backoffMs * 2, retryMaxMs);
    timerRetry = setTimeout(() => {
      timerRetry = null;
      drenar().catch((err) => erro(`retry falhou: ${err.message}`));
    }, espera);
    if (typeof timerRetry.unref === 'function') timerRetry.unref();
    log(`entrega pendente — nova tentativa em ${Math.round(espera / 1000)}s`);
  }

  // Tenta entregar uma notificação. Retorna:
  //   { ok: true }                    → enviada agora
  //   { ok: true, motivo:'enfileirado' } → guardada para o próximo flush
  //   { ok: false, motivo }           → sem destinatário/sem como enfileirar
  async function enviar({ telefone, texto }) {
    const destino = String(telefone || '').trim();
    if (!destino) return { ok: false, motivo: 'whatsapp_indisponivel' };

    const socket = typeof getSocket === 'function' ? getSocket() : null;
    if (!socket) {
      if (enfileirar(texto, destino)) {
        log(`WhatsApp indisponível -> aviso enfileirado para ${destino}`);
        return { ok: true, motivo: 'enfileirado' };
      }
      return { ok: false, motivo: 'whatsapp_indisponivel' };
    }

    try {
      await enviarAgora(socket, destino, texto);
      return { ok: true };
    } catch (err) {
      const guardado = enfileirar(texto, destino);
      erro(`falha no envio (${err.message})${guardado ? ' -> aviso enfileirado' : ''}`);
      if (guardado) agendarRetry();
      return { ok: false, motivo: err.message };
    }
  }

  async function executarDrenagem() {
    const socket = typeof getSocket === 'function' ? getSocket() : null;
    if (!socket) return { enviados: 0, falhas: 0, pendentes: repos.contarAvisosPendentes() };

    // numeroPadrao pode ser string ou função (ex.: settings lidos na hora).
    const destinoPadrao = () =>
      String(typeof numeroPadrao === 'function' ? numeroPadrao() : numeroPadrao || '').trim();

    let enviados = 0;
    let falhas = 0;

    for (;;) {
      const lote = repos.listarAvisosPendentes(limiteLote);
      if (!lote.length) break;

      let progresso = false;

      for (const aviso of lote) {
        const destino = String(aviso.destino || destinoPadrao() || '').trim();
        if (!destino) {
          repos.removerAviso(aviso.id);
          erro(`aviso ${aviso.id} sem destinatário — descartado`);
          progresso = true;
          continue;
        }

        try {
          await enviarAgora(socket, destino, aviso.texto);
          repos.removerAviso(aviso.id);
          tentativas.delete(aviso.id);
          enviados += 1;
          progresso = true;
          log(`aviso entregue: ${String(aviso.texto).slice(0, 90)}`);
        } catch (err) {
          const atual = (tentativas.get(aviso.id) || 0) + 1;
          if (atual >= maxTentativas) {
            tentativas.delete(aviso.id);
            repos.removerAviso(aviso.id);
            erro(`aviso ${aviso.id} descartado após ${atual} tentativas: ${String(err.message).slice(0, 150)}`);
            progresso = true;
          } else {
            tentativas.set(aviso.id, atual);
            falhas += 1;
            erro(`aviso ${aviso.id} falhou (${atual}/${maxTentativas}): ${String(err.message).slice(0, 150)}`);
          }
        }
      }

      if (!progresso) break; // nada saiu: evita loop infinito
      if (lote.length < limiteLote) break;
    }

    if (falhas > 0) agendarRetry();
    else backoffMs = retryBaseMs;

    return { enviados, falhas, pendentes: repos.contarAvisosPendentes() };
  }

  // Drena a fila. Chamadas concorrentes reaproveitam a mesma execução.
  async function drenar() {
    if (drenando) return drenando;
    drenando = executarDrenagem().finally(() => {
      drenando = null;
    });
    return drenando;
  }

  function parar() {
    if (timerRetry) clearTimeout(timerRetry);
    timerRetry = null;
  }

  return {
    enviar,
    enfileirar,
    drenar,
    parar,
    pendentes: () => repos.contarAvisosPendentes(),
  };
}
