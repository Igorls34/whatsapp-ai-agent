// Rotas do chat web (página no navegador + API usada pelo front-end).
//
// Serve a mesma conversa do agente de WhatsApp, mas por HTTP: o cérebro é o
// mesmo (`brain`), só muda o canal ('web'). O front chama `/api/start` e
// `/api/chat` — caminhos mantidos desde a versão anterior.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { html, json, readBody } from '../respond.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGINA_PATH = path.resolve(__dirname, '..', '..', 'web', 'index.html');

const LIMITE_MSGS_POR_MINUTO = 12;
// Permite embutir o chat em um site externo (portfólio).
const CORS = { 'Access-Control-Allow-Origin': '*' };

export function registrarRotasChat(router, { config, repos, memory, webAgent, conversation }) {
  const pagina = fs.readFileSync(PAGINA_PATH, 'utf8');

  // Respostas atendendo simultaneamente (teto anti-gargalo para o LLM local)
  let atendimentosEmCurso = 0;

  // ---------------------------------------------------------------------------
  // Filtro simples de abuso (por sessão): limita mensagens por minuto.
  // ---------------------------------------------------------------------------
  const janelas = new Map();
  function liberal(sessionId) {
    const agora = Date.now();
    const v = (janelas.get(sessionId) || []).filter((t) => agora - t < 60000);
    v.push(agora);
    janelas.set(sessionId, v);
    // Poda: ao crescer demais, descarta sessões ociosas (> 10min sem mensagem)
    if (janelas.size > 500) {
      for (const [k, arr] of [...janelas.entries()]) {
        if (janelas.size <= 500) break;
        if (agora - (arr[arr.length - 1] || 0) > 10 * 60000) janelas.delete(k);
      }
    }
    return v.length <= LIMITE_MSGS_POR_MINUTO;
  }

  // Lê/registra o visitante (sem boas-vindas — no web é só o chat).
  function lerCliente(sessionId) {
    let cliente = null;
    try {
      cliente = repos.getCliente(sessionId);
    } catch (err) {
      console.error('[web] banco indisponível', err);
      return {};
    }
    if (!cliente) {
      repos.upsertCliente({ telefone: sessionId });
      repos.tocarUltimaInteracao(sessionId);
      return {};
    }
    return { nome: cliente.nome, resumo: cliente.resumo || '' };
  }

  // Estado de bloqueio da sessão (chat web: temporário de 1h, expira sozinho).
  function estadoBloqueio(sessionId) {
    try {
      return repos.estadoChat(sessionId);
    } catch (err) {
      console.error('[web] falha ao checar bloqueio:', err.message);
      return { bloqueado: false, temporario: false, motivo: null };
    }
  }

  async function responder({ sessionId, mensagem }) {
    const texto = String(mensagem || '').trim();

    // Contexto do cliente (memória de longo prazo); registra visitantes novos
    let contexto;
    try {
      contexto = lerCliente(sessionId);
    } catch (err) {
      console.error('[web] banco indisponível, atendendo sem contexto', err);
      contexto = {};
    }

    memory.add(sessionId, 'user', texto);

    let reply;
    try {
      reply = await conversation.responderComAgente({
        agent: webAgent,
        id: sessionId,
        resumo: contexto.resumo,
        mensagem: texto,
      });
    } catch (err) {
      console.error('[web] erro ao gerar resposta:', err);
      reply =
        'Agora não consegui responder 😅, mas já vi sua mensagem. Assim que o Igor pegar no celular ele responde — ou pode me chamar de novo em instantes.';
    }

    // Memória de longo prazo (resumo periódico) + última interação
    await conversation.manterMemoria({ id: sessionId, resumoAnterior: contexto.resumo });
    conversation.tocarInteracao(sessionId);

    for (const parte of conversation.separarPartes(reply)) {
      try {
        memory.add(sessionId, 'assistant', parte);
      } catch (_) {
        /* memória opcional */
      }
    }

    return {
      reply,
      partes: conversation.separarPartes(reply),
    };
  }

  // Página do chat (raiz do app unificado; `/chat` como alias)
  router.get('/', ({ res }) => html(res, 200, pagina));
  router.get('/chat', ({ res }) => html(res, 200, pagina));

  // Nova sessão: gera id e registra o visitante (sem boas-vindas)
  router.get('/api/start', ({ res, url }) => {
    const sessionId = url.searchParams.get('sessionId') || `web_${crypto.randomUUID()}`;
    lerCliente(sessionId);
    if (estadoBloqueio(sessionId).bloqueado) {
      return json(res, 200, { ok: true, sessionId, indisponivel: true }, CORS);
    }
    return json(
      res,
      200,
      {
        ok: true,
        sessionId,
        atendente: 'Assistente Virtual do Igor Dev',
      },
      CORS
    );
  });

  // Enviar mensagem
  router.post('/api/chat', async ({ req, res }) => {
    const body = await readBody(req);
    const sessionId = String(body.sessionId || 'web_anonimo').replace(/[^\w-]/g, '');
    const mensagem = String(body.message || '').trim().slice(0, 2_000);

    if (!mensagem) return json(res, 400, { ok: false, erro: 'Mensagem vazia.' }, CORS);

    // Chat fechado por comportamento abusivo: indisponível até expirar (1h)
    const estado = estadoBloqueio(sessionId);
    if (estado.bloqueado) {
      return json(res, 200, { ok: true, indisponivel: true, motivo: estado.motivo }, CORS);
    }

    if (!liberal(sessionId)) {
      return json(
        res,
        429,
        { ok: false, erro: 'Você está enviando rápido demais. Aguarde um instante e tente de novo. 😊' },
        CORS
      );
    }

    // Teto de concorrência: evita que muitas sessões estourem o LLM local.
    if (atendimentosEmCurso >= config.limites.webMaxConcurrent) {
      return json(
        res,
        503,
        {
          ok: false,
          erro: 'Muito movimento agora 😅. Espera um instante e tenta de novo — o assistente já atende.',
        },
        CORS
      );
    }

    atendimentosEmCurso += 1;
    let resultado;
    try {
      resultado = await Promise.race([
        responder({ sessionId, mensagem }),
        new Promise((_, rejeitar) =>
          setTimeout(
            () => rejeitar(Object.assign(new Error('timeout'), { code: 'WEB_TIMEOUT' })),
            config.limites.webTimeoutMs
          )
        ),
      ]);
    } catch (err) {
      if (err?.code === 'WEB_TIMEOUT') {
        return json(
          res,
          503,
          { ok: false, erro: 'Estou demorando mais que o normal por aqui 😅. Pode repetir em instantes.' },
          CORS
        );
      }
      throw err;
    } finally {
      atendimentosEmCurso -= 1;
    }
    resultado.ok = true;
    return json(res, 200, resultado, CORS);
  });
}
