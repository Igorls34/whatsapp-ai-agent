// Orquestra o fluxo RAG por mensagem recebida:
// 1. Busca memória persistente do cliente no banco (por número)
// 2. Injeta o resumo no system prompt do LLM (a thread fica na sessão do opencode)
// 3. Envia a resposta gerada via WhatsApp (podem ser várias mensagens com |||)
// 4. Periodicamente, gera o novo resumo da interação e grava no banco

// Separa respostas em múltiplas mensagens (|||) para ficar natural no WhatsApp
export const MSG_SEPARATOR = '|||';
const MSG_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Envia uma resposta (possivelmente dividida em várias mensagens) ao cliente
async function enviarResposta(socket, remoteJid, telefone, reply, memory) {
  const partes = String(reply)
    .split(MSG_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);

  if (partes.length === 0) {
    console.warn('[msg] resposta vazia — nada enviado');
    return;
  }

  for (let i = 0; i < partes.length; i++) {
    await socket.sendMessage(remoteJid, { text: partes[i] });
    try {
      memory.add(telefone, 'assistant', partes[i]);
    } catch (err) {
      /* memória opcional */
    }
    console.log(`[msg] -> ${telefone}: ${partes[i].slice(0, 120)}`);
    if (i < partes.length - 1) await sleep(MSG_DELAY_MS);
  }
}

export function createMessageHandler({ repos, getSocket, agent, summarizer, memory, imageService, config }) {

  // Cliente que não interagiu nos últimos N horas é tratado como "novo" (recebe boas-vindas).
  function clienteInativo(cliente, horas) {
    if (!cliente?.ultima_interacao_at) return true;
    const t = Date.parse(String(cliente.ultima_interacao_at).replace(' ', 'T'));
    if (Number.isNaN(t)) return true;
    return Date.now() - t > horas * 3600000;
  }

  return async function handleMessage({ remoteJid, telefone: telefoneRecebido, pushName, text, type = 'text' }) {
    const telefone = telefoneRecebido || remoteJid.replace('@s.whatsapp.net', '');
    const socket = getSocket();

    // Segurança: cliente com chat fechado (abuso) não é atendido. Bloqueio
    // temporário expirado libera automaticamente; permanente ignora tudo.
    try {
      const estado = repos.estadoChat(telefone);
      if (estado.bloqueado) {
        console.log(`[seguranca] mensagem ignorada de ${telefone} (${estado.temporario ? 'bloqueio temporario' : 'chat fechado'}): ${estado.motivo}`);
        return;
      }
    } catch (err) {
      console.error('[seguranca] falha ao checar bloqueio:', err.message);
    }

    const midia = type !== 'text';
    console.log(`[msg] de ${telefone}${pushName ? ` (${pushName})` : ''}: ${midia ? `[${type}]` : text.slice(0, 120)}`);

    // Edge case: mensagens de mídia (imagem, vídeo, áudio, sticker...). O bot só
    // entende texto no momento; avisa e pede pra digitar a demanda.
    if (midia && socket) {
      const aviso = `Agora só consigo ler mensagens de texto por aqui 🙏. Pode digitar sua demanda pra mim? Assim o Igor já sabe como te ajudar, tudo bem? 😊`;
      await socket.sendMessage(remoteJid, { text: aviso });
      try {
        memory.add(telefone, 'assistant', aviso);
      } catch (err) {
        /* memória opcional */
      }
      console.log(`[msg] -> ${telefone} ([${type}] recebido, pedido texto)`);
      return;
    }

    // 1. Resgata o contexto persistido (edge case: banco offline -> segue sem contexto)
    let contexto;
    let ehNovoOuInativo = false;
    try {
      const cliente = repos.getCliente(telefone);
      if (!cliente) {
        repos.upsertCliente({ telefone, nome: pushName });
        contexto = { telefone, nome: pushName, resumo: '' };
        ehNovoOuInativo = true;
      } else {
        if (pushName && pushName !== cliente.nome) repos.upsertCliente({ telefone, nome: pushName });
        contexto = { telefone, nome: cliente.nome || pushName, resumo: cliente.resumo || '' };
        ehNovoOuInativo = clienteInativo(cliente, config.welcomes.inativoHoras);
      }
    } catch (err) {
      console.error('[memoria] banco indisponível, atendendo sem contexto', err);
      contexto = { telefone, nome: pushName, resumo: '' };
    }

    // 1.5 Boas-vindas: cliente novo ou que não interagia há muito tempo recebe a
    // apresentação. Com imagens ativas, envia o gif/imagem + legenda; desativadas,
    // envia apenas o texto de apresentação.
    if (socket && ehNovoOuInativo && config.welcomes.imagem) {
      if (config.imagens.ativo) {
        const resultado = await imageService.enviarBoasVindas({ telefone, remoteJid });
        if (resultado.ok) {
          console.log(`[welcome] material enviado a ${telefone}: ${resultado.imagem_enviada}`);
        } else {
          console.warn(`[welcome] sem material (${resultado.motivo}) — enviando só texto`);
          await socket.sendMessage(remoteJid, { text: config.welcomes.texto });
        }
      } else {
        await socket.sendMessage(remoteJid, { text: config.welcomes.texto });
        console.log(`[welcome] texto de boas-vindas enviado a ${telefone}`);
      }
      memory.add(telefone, 'assistant', config.welcomes.texto);
    }

    // 2. Registra a mensagem na memória volátil (usada pro resumo periódico)
    memory.add(telefone, 'user', text);

    // 3. LLM (opencode local) com function calling via protocolo de texto
    let reply;
    try {
      const servicos = repos.listarServicosAtivos();
      const imagens = config.imagens.ativo ? imageService.listar() : [];
      reply = await agent.run({ telefone, resumo: contexto.resumo, mensagem: text, servicos, imagens });
    } catch (err) {
      console.error('[llm] erro ao gerar resposta:', err);
      reply =
        'Agora não consegui responder 😅, mas já vi sua mensagem. Assim que o Igor pegar no celular ele responde. Me chama de novo em instantes se precisar.';
    }

    if (reply && socket) {
      await enviarResposta(socket, remoteJid, telefone, reply, memory);
    } else {
      console.warn('[msg] resposta vazia ou socket indisponível — nada enviado');
    }

    // 4. De tempos em tempos: resume a conversa e persiste na memória de longo prazo
    if (memory.isSummaryDue(telefone)) {
      try {
        const novoResumo = await summarizer.summarize({
          telefone,
          resumoAnterior: contexto.resumo,
          historico: memory.history(telefone),
        });
        if (novoResumo) repos.atualizarResumo({ telefone, resumo: novoResumo });
        memory.resetSummaryCounter(telefone);
        console.log(`[memoria] resumo de ${telefone} atualizado`);
      } catch (err) {
        console.error('[memoria] falha ao gerar resumo:', err);
      }
    }

    try {
      repos.tocarUltimaInteracao(telefone);
    } catch (err) {
      /* banco offline: ignore */
    }
  };
}