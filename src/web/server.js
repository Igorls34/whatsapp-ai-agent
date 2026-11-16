// Modo avulso (legado): sobe SÓ o chat web, na porta antiga (WEB_PORT).
// No sistema unificado o chat é servido em `/` pelo processo principal
// (`npm start` / `src/index.js`). Use este arquivo apenas para desenvolvimento
// isolado do chat.
import { config } from '../config.js';
import { createBrain } from '../core/brain.js';
import { createConversationService } from '../conversation/service.js';
import { createRouter } from '../http/router.js';
import { criarServidorHttp } from '../http/server.js';
import { registrarRotasChat } from '../http/routes/chat.js';

const brain = createBrain({ config });
const conversation = createConversationService({ brain, config });
const repos = brain.repos;
const { agent } = brain.createChannel({
  canal: 'web',
  dbEnqueue: (texto) => repos.enfileirarAviso(texto),
});

const router = createRouter();
registrarRotasChat(router, { config, repos, memory: brain.memory, webAgent: agent, conversation });

brain.adapter
  .health()
  .then(({ version }) => {
    console.log(`[web] opencode server OK (v${version}).`);
  })
  .catch((err) => {
    console.warn(`[web] ${err.message} — o chat responderá com aviso até o opencode servir subir.`);
  });

criarServidorHttp({ router, logPrefixo: 'web' }).listen(config.web.port, config.web.host, () => {
  console.log(`[web] Chat disponível em http://${config.web.host}:${config.web.port}`);
});
