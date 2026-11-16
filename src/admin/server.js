// Modo avulso (legado): sobe SÓ o painel, na porta antiga (ADMIN_PORT).
// No sistema unificado o painel é servido em /admin pelo processo principal
// (`npm start` / `src/index.js`). Use este arquivo apenas para desenvolvimento
// isolado do painel.
import { config } from '../config.js';
import { createStore } from '../core/brain.js';
import { createRouter } from '../http/router.js';
import { criarGuardAdmin } from '../http/auth.js';
import { criarServidorHttp } from '../http/server.js';
import { registrarRotasAdmin } from '../http/routes/admin.js';

const { repos } = createStore(config);
const router = createRouter({ guards: { admin: criarGuardAdmin(config.admin.token) } });
registrarRotasAdmin(router, { repos, pagePaths: ['/'] });

criarServidorHttp({ router, logPrefixo: 'admin' }).listen(config.admin.port, '127.0.0.1', () => {
  console.log(`[admin] Painel de controle em http://127.0.0.1:${config.admin.port}`);
  console.log(`[admin] Autenticação: ${config.admin.token ? 'Bearer token ativo' : 'desativada (acesso local)'}`);
});
