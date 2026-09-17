import { config } from '../config.js';
import { createSemaphore } from '../services/backpressure.js';

// Semáforo global do processo: limita o número de turnos de IA rodando em
// paralelo (bot e web somados) para não estourar o opencode serve local.
const semaforoGlobal = createSemaphore(config.limites.llmMaxConcurrent);

// Adapter que usa o próprio opencode como IA, via o servidor headless local:
//
//   opencode serve --port 4096
//
// Ele fala direto com a session API do opencode (POST /session/:id/message),
// que já guarda o histórico de cada conversa no lado do servidor. Uma sessão
// por cliente (telefone). O modelo usado é o default do opencode na máquina
// (ex: opencode/big-pickle — gratuito), podendo ser sobrescrito por OPENCODE_MODEL.

function base64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

export function createLocalOpencodeAdapter(overrides = {}) {
  const { url, password, username, model } = {
    url: config.llm.opencode.url,
    password: config.llm.opencode.password,
    username: config.llm.opencode.username,
    model: config.llm.opencode.model,
    ...overrides,
  };

  const base = url.replace(/\/+$/, '');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (password) {
    headers.Authorization = `Basic ${base64(`${username}:${password}`)}`;
  }

  // Mapa telefone -> sessão do opencode + fila para não sobrepor turnos do mesmo cliente.
  const sessions = new Map();
  const MAX_SESSOES = 300;

  async function request(path, { method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.limites.llmTimeoutMs);
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        const e = new Error(`opencode server não respondeu em ${config.limites.llmTimeoutMs}ms — operação cancelada`);
        e.code = 'LLM_TIMEOUT';
        throw e;
      }
      throw new Error(
        `Não consegui falar com o opencode server em ${base}. ` +
          `Rode "opencode serve --port 4096" em outro terminal. (detalhe: ${err.message})`
      );
    } finally {
      clearTimeout(timer);
    }

    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new Error(`opencode server respondeu HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }

  // Poda lazily: acima de MAX_SESSOES, descarta as ociosas (> 24h) e, se
  // necessário, as mais antigas. Evita vazamento de memória com clientes únicos.
  function podarSessoes() {
    if (sessions.size <= MAX_SESSOES) return;
    const agora = Date.now();
    for (const [k, e] of [...sessions.entries()]) {
      if (sessions.size <= MAX_SESSOES) break;
      if (agora - (e.lastUsed || 0) > 24 * 3600000) sessions.delete(k);
    }
    if (sessions.size <= MAX_SESSOES) return;
    const maisAntigas = [...sessions.entries()].sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
    for (const [k] of maisAntigas) {
      if (sessions.size <= 200) break;
      sessions.delete(k);
    }
  }

  function lock(sessionKey) {
    const entry = sessions.get(sessionKey);
    if (!entry) return null;
    return (async () => {
      // Espera o turno anterior terminar antes de começar o próximo.
      if (entry.tail) {
        await entry.tail.catch(() => {});
      }
    })();
  }

  function runLocked(sessionKey, fn) {
    const entry = sessions.get(sessionKey) || { tail: Promise.resolve() };
    sessions.set(sessionKey, entry);
    const run = entry.tail.catch(() => {}).then(fn);
    entry.tail = run;
    return run;
  }

  function extractReply(parts) {
    let reply = '';
    for (const part of parts || []) {
      if (part?.type === 'text' && part.text && part.text.trim()) {
        reply = part.text;
      }
    }
    return reply.trim();
  }

  return {
    // Checa se o servidor do opencode está de pé. Lança erro amigável se não.
    async health() {
      const data = await request('/global/health');
      return { healthy: data.healthy === true, version: data.version };
    },

    // Garante uma sessão do opencode para o cliente (alvo: telefone).
    async ensureSession(sessionKey) {
      if (!sessions.has(sessionKey)) {
        podarSessoes();
        const session = await request('/session', {
          method: 'POST',
          body: { title: `whatsapp-agent:${sessionKey}` },
        });
        sessions.set(sessionKey, { id: session.id, tail: Promise.resolve(), lastUsed: Date.now() });
      }
      const entry = sessions.get(sessionKey);
      entry.lastUsed = Date.now();
      return entry.id;
    },

    async existsSession(sessionKey) {
      return sessions.has(sessionKey);
    },

    // Envia um turno de conversa para a sessão do cliente e aguarda a resposta final.
    async runTurn({ sessionKey, system, text }) {
      const id = await this.ensureSession(sessionKey);
      return runLocked(sessionKey, async () => {
        try {
          return await semaforoGlobal.run(async () => {
            const data = await request(`/session/${id}/message`, {
              method: 'POST',
              body: {
                parts: [{ type: 'text', text }],
                system,
                ...(model ? { model } : {}),
              },
            });
            return extractReply(data.parts);
          });
        } catch (err) {
          // Timeout da IA: descarta a sessão para o próximo turno não herdar
          // uma fila/vínculo preso naquela conversa.
          if (err?.code === 'LLM_TIMEOUT') this.clearSession(sessionKey);
          throw err;
        }
      });
    },

    // Chamada única sem estado (usada pelo summarizer): sessão efêmera descartada.
    async complete({ system, text, title = 'whatsapp-agent:aux' }) {
      const session = await request('/session', { method: 'POST', body: { title } });
      try {
        return await semaforoGlobal.run(async () => {
          const data = await request(`/session/${session.id}/message`, {
            method: 'POST',
            body: {
              parts: [{ type: 'text', text }],
              system,
              ...(model ? { model } : {}),
            },
          });
          return extractReply(data.parts);
        });
      } finally {
        await request(`/session/${session.id}`, { method: 'DELETE' }).catch(() => {});
      }
    },

    clearSession(sessionKey) {
      sessions.delete(sessionKey);
    },
  };
}