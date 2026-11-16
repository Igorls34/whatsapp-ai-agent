// Montagem do servidor HTTP unificado.
//
// Um único listener serve tudo o que antes ficava espalhado em portas/processos:
//   /        → chat web
//   /admin   → painel de gestão (assets em /vendor/*, APIs em /api/*)
//   /qr      → pareamento do WhatsApp (/api/qr e /qr.png)
//   /health  → healthcheck do app
import http from 'node:http';
import { createRouter } from './router.js';
import { criarGuardAdmin } from './auth.js';
import { json } from './respond.js';
import { registrarRotasAdmin } from './routes/admin.js';
import { registrarRotasChat } from './routes/chat.js';
import { registrarRotasQr } from './routes/qr.js';
import { registrarRotasHealth } from './routes/health.js';
import { registrarRotasConfiguracoes } from './routes/configuracoes.js';
import { registrarRotasAgente } from './routes/agente.js';

export function criarRouterPadrao({ config, brain, repos, memory, webAgent, conversation, qrState, pagePathsAdmin, onAgendaAlterada }) {
  const router = createRouter({ guards: { admin: criarGuardAdmin(config.admin.token) } });
  registrarRotasAdmin(router, { repos: repos || brain.repos, pagePaths: pagePathsAdmin });
  registrarRotasChat(router, { config, repos: repos || brain.repos, memory, webAgent, conversation });
  registrarRotasQr(router, { qrState });
  registrarRotasHealth(router, { brain, qrState });
  registrarRotasConfiguracoes(router, { settings: brain.settings, onAgendaAlterada });
  registrarRotasAgente(router, { config, qrState });
  return router;
}

// Cria o servidor HTTP a partir de um router. Trata CORS (preflight) e converte
// erros não capturados em 500, sem derrubar o processo.
export function criarServidorHttp({ router, logPrefixo = 'http' }) {
  return http.createServer(async (req, res) => {
    // CORS: permite embutir o chat em um site externo (portfólio).
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      return res.end();
    }

    try {
      const tratado = await router.handle(req, res);
      if (!tratado) return json(res, 404, { ok: false, erro: 'Rota não encontrada.' });
    } catch (err) {
      console.error(`[${logPrefixo}] erro:`, err);
      if (!res.headersSent) return json(res, 500, { ok: false, erro: 'Erro interno do servidor.' });
      return res.end();
    }
  });
}
