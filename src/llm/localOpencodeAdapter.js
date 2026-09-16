import { config } from '../config.js';

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

  async function request(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new Error(
        `Não consegui falar com o opencode server em ${base}. ` +
          `Rode "opencode serve --port 4096" em outro terminal. (detalhe: ${err.message})`
      );
    }

    if (res.status < 200 || res.status >= 300) {
      const text = await res.text();
      throw new Error(`opencode server respondeu HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
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
        const session = await request('/session', {
          method: 'POST',
          body: { title: `whatsapp-agent:${sessionKey}` },
        });
        sessions.set(sessionKey, { id: session.id, tail: Promise.resolve() });
      }
      return sessions.get(sessionKey).id;
    },

    async existsSession(sessionKey) {
      return sessions.has(sessionKey);
    },

    // Envia um turno de conversa para a sessão do cliente e aguarda a resposta final.
    async runTurn({ sessionKey, system, text }) {
      const id = await this.ensureSession(sessionKey);
      return runLocked(sessionKey, async () => {
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
    },

    // Chamada única sem estado (usada pelo summarizer): sessão efêmera descartada.
    async complete({ system, text, title = 'whatsapp-agent:aux' }) {
      const session = await request('/session', { method: 'POST', body: { title } });
      try {
        const data = await request(`/session/${session.id}/message`, {
          method: 'POST',
          body: {
            parts: [{ type: 'text', text }],
            system,
            ...(model ? { model } : {}),
          },
        });
        return extractReply(data.parts);
      } finally {
        await request(`/session/${session.id}`, { method: 'DELETE' }).catch(() => {});
      }
    },

    clearSession(sessionKey) {
      sessions.delete(sessionKey);
    },
  };
}