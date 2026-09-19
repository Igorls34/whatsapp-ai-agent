import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { openDatabase } from '../db/database.js';
import { createRepositories } from '../db/repositories.js';
import { createConversationMemory } from '../memory/conversationMemory.js';
import { createLocalOpencodeAdapter } from '../llm/localOpencodeAdapter.js';
import { createAgent } from '../llm/agent.js';
import { createSummarizer } from '../llm/summarizer.js';
import { createToolExecutor } from '../services/toolExecutor.js';
import { createImageService } from '../services/imageService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGINA_PATH = path.join(__dirname, 'index.html');
const MAX_RESP_TOKENS = 1500;
const LIMITE_MSGS_POR_MINUTO = 12;
// Respostas atendendo simultaneamente (teto anti-gargalo para o LLM local)
let atendimentosEmCurso = 0;

// ---------------------------------------------------------------------------
// Setup: mesmos componentes do bot do WhatsApp, sem o transporte Baileys.
// getSocket() = null: ferramentas que dependem do WhatsApp retornam aviso
// amigável ao LLM em vez de quebrar.
// ---------------------------------------------------------------------------
const db = openDatabase();
const repos = createRepositories(db);
const memory = createConversationMemory({
  keepMessages: config.memory.keepMessages,
  summarizeEvery: config.memory.summarizeEvery,
});
const adapter = createLocalOpencodeAdapter();
const executor = createToolExecutor({
  repos,
  getSocket: () => null,
  config,
  canal: 'web',
  dbEnqueue: (texto) => repos.enfileirarAviso(texto),
});
const agent = createAgent({ adapter, executor, canal: 'web' });
const summarizer = createSummarizer({ adapter });
const imageService = createImageService({ getSocket: () => null, config });
const pagina = fs.readFileSync(PAGINA_PATH, 'utf8');

adapter
  .health()
  .then(({ version }) => {
    console.log(`[web] opencode server OK (v${version}). Modelo: ${config.llm.opencode.model || 'default da máquina'}`);
  })
  .catch((err) => {
    console.warn(`[web] ${err.message} — o chat responderá com aviso até o opencode servir subir.`);
  });

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
    const servicos = repos.listarServicosAtivos();
    const imagens = config.imagens.ativo ? imageService.listar() : [];
    reply = await agent.run({
      telefone: sessionId,
      resumo: contexto.resumo,
      mensagem: texto,
      servicos,
      imagens,
    });
  } catch (err) {
    console.error('[web] erro ao gerar resposta:', err);
    reply =
      'Agora não consegui responder 😅, mas já vi sua mensagem. Assim que a equipe pegar no celular ela responde — ou pode me chamar de novo em instantes.';
  }

  // Memória de longo prazo (resumo periódico)
  if (memory.isSummaryDue(sessionId)) {
    try {
      const novoResumo = await summarizer.summarize({
        telefone: sessionId,
        resumoAnterior: contexto.resumo,
        historico: memory.history(sessionId),
      });
      if (novoResumo) repos.atualizarResumo({ telefone: sessionId, resumo: novoResumo });
      memory.resetSummaryCounter(sessionId);
      console.log(`[web] resumo de ${sessionId} atualizado`);
    } catch (err) {
      console.error('[web] falha ao gerar resumo:', err);
    }
  }

  try {
    repos.tocarUltimaInteracao(sessionId);
  } catch (err) {
    /* banco offline: ignore */
  }

  for (const parte of String(reply).split('|||').map((p) => p.trim()).filter(Boolean)) {
    try {
      memory.add(sessionId, 'assistant', parte);
    } catch (_) {
      /* memória opcional */
    }
  }

  return {
    reply,
    partes: String(reply)
      .split('|||')
      .map((p) => p.trim())
      .filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Servidor HTTP
// ---------------------------------------------------------------------------
function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS para permitir embutir o chat em um site externo (portfólio)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // Página do chat
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(pagina);
    }

    // Nova sessão: gera id e registra o visitante (sem boas-vindas)
    if (req.method === 'GET' && pathname === '/api/start') {
      const sessionId = url.searchParams.get('sessionId') || `web_${crypto.randomUUID()}`;
      lerCliente(sessionId);
      if (estadoBloqueio(sessionId).bloqueado) {
        return json(res, 200, { ok: true, sessionId, indisponivel: true });
      }
      return json(res, 200, {
        ok: true,
        sessionId,
        atendente: 'Assistente Virtual',
      });
    }

    // Enviar mensagem
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await readBody(req);
      const sessionId = String(body.sessionId || 'web_anonimo').replace(/[^\w-]/g, '');
      const mensagem = String(body.message || '').trim().slice(0, 2_000);

      if (!mensagem) return json(res, 400, { ok: false, erro: 'Mensagem vazia.' });

      // Chat fechado por comportamento abusivo: indisponível até expirar (1h)
      const estado = estadoBloqueio(sessionId);
      if (estado.bloqueado) {
        return json(res, 200, { ok: true, indisponivel: true, motivo: estado.motivo });
      }

      if (!liberal(sessionId)) {
        return json(res, 429, { ok: false, erro: 'Você está enviando rápido demais. Aguarde um instante e tente de novo. 😊' });
      }

      // Teto de concorrência: evita que muitas sessões estourem o LLM local.
      if (atendimentosEmCurso >= config.limites.webMaxConcurrent) {
        return json(res, 503, {
          ok: false,
          erro: 'Muito movimento agora 😅. Espera um instante e tenta de novo — o assistente já atende.',
        });
      }

      atendimentosEmCurso += 1;
      let resultado;
      try {
        resultado = await Promise.race([
          responder({ sessionId, mensagem }),
          new Promise((_, rejeitar) =>
            setTimeout(() => rejeitar(Object.assign(new Error('timeout'), { code: 'WEB_TIMEOUT' })), config.limites.webTimeoutMs)),
        ]);
      } catch (err) {
        if (err?.code === 'WEB_TIMEOUT') {
          return json(res, 503, { ok: false, erro: 'Estou demorando mais que o normal por aqui 😅. Pode repetir em instantes.' });
        }
        throw err;
      } finally {
        atendimentosEmCurso -= 1;
      }
      resultado.ok = true;
      return json(res, 200, resultado);
    }

    return json(res, 404, { ok: false, erro: 'Rota não encontrada.' });
  } catch (err) {
    console.error('[web] erro:', err);
    return json(res, 500, { ok: false, erro: 'Erro interno.' });
  }
});

server.listen(config.web.port, config.web.host, () => {
  console.log(`[web] Chat disponível em http://${config.web.host}:${config.web.port}`);
});