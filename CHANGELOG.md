# Changelog

Todas as mudanças relevantes do projeto, em ordem cronológica (da mais recente para a mais antiga). Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionado com [SemVer](https://semver.org/lang/pt-BR/).

## [0.7.1] — 2026-11-16

### Alterado
- Redesenho da aba **Configurações → Horários de trabalho**: expediente semanal em grade (liga/desliga por dia, com hora de início/fim), janela de agendamento em selects e pré-visualização do `WORK_SCHEDULE` em tempo real (antes era um campo de texto bruto).

## [0.7.0] — 2026-11-16

### Adicionado
- **`src/settings/manager.js`** — configurações editáveis pelo painel, persistidas em `data/settings.json` (gitignored) e que **sobrescrevem o `.env`** quando presentes, valendo na hora.
- Aba **⚙️ Configurações** no painel admin:
  - **Notificações de agendamento**: WhatsApp e email do Igor.
  - **Horários de trabalho**: expediente (`WORK_SCHEDULE`), início/fim do dia, duração do slot e horizonte — re-seeda a agenda imediatamente.
- Rotas `GET/PUT /api/configuracoes` (guard admin, validação com erro claro em 400).
- Testes `test/settings.test.js` e `test/configuracoes.test.js`.

### Alterado
- `src/db/autoSeed.js`: `gerarSlots(repos, agenda)` recebe a agenda (settings) para refletir o painel na hora.
- `src/notifications/outbox.js`: `numeroPadrao` pode ser função (destino lido dos settings na hora da drenagem).
- `notificationService` usa os destinos dos settings; `brain` cria o settings manager e o expõe.

## [0.6.2] — 2026-11-16

### Adicionado
- Aba **📱 WhatsApp** no painel admin: status da conexão + QR code embutido (auto-refresh via `/api/qr` e `/qr.png`), com link para a página `/qr`.

## [0.6.1] — 2026-11-15

### Adicionado
- **`src/version.js`** — versão do app (do `package.json`) e commit opcional (`APP_COMMIT`) como identidade do que está **rodando**.
- `/health` reporta **`app.versao`/`app.commit`**.
- Teste `test/health-http.test.js` — sobe um servidor HTTP real e valida `/health` (200 com JSON e 503 quando o banco falha).

### Alterado
- **`deploy/deploy.sh`** agora prova o que subiu: imprime `commit (versão)`, exporta `APP_COMMIT` para a unit e só considera o deploy OK quando o `/health` no ar **reporta a mesma versão/commit**; caso contrário, faz rollback (e reajusta `APP_COMMIT`).
- `docs/OPERACAO.md` documenta a resposta do `/health` e a verificação de versão no deploy.

## [0.6.0] — 2026-11-15

### Adicionado
- **`deploy/whatsapp-ai-agent.service`** — modelo da unit systemd de usuário do app único (`node start.js`, `Restart=always`, PATH com `~/.npm-global/bin`), com alternativa para servidores onde o `opencode serve` já roda como outra unit.
- Seções de **deploy e healthcheck** no guia do operador (`/health`, `journalctl`, rollback).

### Alterado
- **`docs/OPERACAO.md` reescrito** para a topologia de app único: uma porta (`/`, `/admin`, `/qr`, `/health`), QR no terminal **e** em `/qr`, logs via `journalctl`, outbox nas notificações e modos avulsos marcados como dev.
- **`README.md`** — tabela de componentes e “onde abrir cada coisa” apontam para a porta única; QR documentado em `/qr`.
- **`docs/REFERENCIA.md`** — comandos (`npm start`/`start:bot`, avulsos) e configuração (`HTTP_HOST`/`HTTP_PORT`, `ADMIN_TOKEN`; `ADMIN_PORT`/`WEB_*` como legado).
- Páginas de funcionalidades (`painel-admin`, `chat-web`, `persona`) e guias (`AJUSTES`, `AVALIACAO`) atualizados para `http://127.0.0.1:4000/...`.
- Status do plano: fases 0–4 concluídas.

## [0.5.0] — 2026-11-15

### Adicionado
- **`src/notifications/outbox.js`** — caixa de saída única do processo: envia na hora quando o WhatsApp está conectado e, sem socket (ou com falha), persiste o aviso em `avisos_pendentes` para entrega posterior.
- Coluna **`destino`** em `avisos_pendentes` (migração automática para bancos antigos) — permite avisar números diferentes (agendamento e emergência).
- Repositórios `contarAvisosPendentes`/`listarAvisosPendentes(limite)` e `enfileirarAviso(texto, destino)`.
- Drenagem da outbox **no evento de conexão** do WhatsApp (`brain.onSocket`), com retry exponencial (5s → 5min, máx. 5 tentativas).
- `/health` reporta `notificacoes.pendentes` (tamanho da outbox).
- Testes `test/outbox.test.js` e `test/migrations.test.js`.

### Alterado
- `notificationService` e `emergencyService` passam a usar a outbox — a emergência deixou de ser só log quando o WhatsApp está fora.
- `createBrain()` cria o `pacer` e a `outbox` compartilhados e expõe `onSocket()`; canais recebem `outbox` em vez de `dbEnqueue`.
- Fim do polling de 30s da fila de avisos em `src/app.js`.

### Removido
- `dbEnqueue` como parâmetro dos canais/serviços (substituído pela outbox).

## [0.4.0] — 2026-11-15

### Adicionado
- **`src/http/`** — servidor HTTP unificado com router próprio (sem dependências):
  - `GET /` e `/chat` → chat web no navegador
  - `GET /admin` → painel de gestão (assets em `/vendor/*`, APIs em `/api/*`)
  - `GET /qr`, `GET /api/qr`, `GET /qr.png` → pareamento nativo do WhatsApp
  - `GET /health` → healthcheck do app (banco, LLM e WhatsApp)
- **`src/app.js`** — aplicação única: cérebro + HTTP + WhatsApp no mesmo processo.
- **`src/whatsapp/qrState.js`** — estado do QR em memória (sem arquivos/popup).
- Configuração `HTTP_HOST`/`HTTP_PORT` (padrão `127.0.0.1:4000`).
- Testes `test/http.test.js` (router, guard do painel e QR).

### Alterado
- `src/index.js` agora sobe **tudo** (bot + painel + chat + QR + health).
- `start.js` supervisiona apenas 2 processos: `opencode serve` e o app.
- `deploy/deploy.sh` faz healthcheck em `/health` (com `HEALTH_URL` configurável).
- `src/admin/server.js` e `src/web/server.js` viraram modos avulsos finos, reusando as rotas compartilhadas.
- `src/whatsapp/client.js` expõe `onQr`/`onStatus` e preserva os callbacks na reconexão.
- `.env.example` documenta a porta única e o pareamento via rede local.

### Removido
- Popup do Windows, PNG `qr/qr-atual.png` e dependência do servidor Python ad-hoc `:8090`.
- Servidores HTTP duplicados (painel e chat agora compartilham router e helpers).

## [0.3.0] — 2026-11-15

### Adicionado
- **`src/core/brain.js`** — `createBrain()` (cérebro compartilhado: banco + repositórios + memória + adapter + summarizer + imageService) e `createStore()` (banco + repositórios para o painel).
- **`src/conversation/service.js`** — orquestrador de turno agnóstico de canal (`separarPartes`, `responderComAgente`, `manterMemoria`, `tocarInteracao`).
- Teste `test/conversation.test.js`.

### Alterado
- `src/index.js`, `src/web/server.js`, `src/admin/server.js` e `src/whatsapp/messageHandler.js` passam a usar o cérebro compartilhado — refactor **sem mudança de comportamento** (remove a duplicação de setup que existia em 3 processos).

## [0.2.0] — 2026-11-15

### Adicionado
- **Disciplina de versionamento**: SemVer + Conventional Commits + tags (`docs/VERSIONAMENTO.md`).
- **`CHANGELOG.md`** (este arquivo) como índice humano das versões.
- **Plano de integração em fases** (`docs/PLANO_INTEGRACAO.md`) rumo ao sistema único.
- **Testes unitários** com `node:test` (sem dependências novas):
  - `toolProtocol` (`parseToolEnvelope`, `buildToolResultMessage`, `withToolProtocol`)
  - `agent` (`buildServiceCatalog`, `buildImageCatalog`)
  - `repositories` (`toLocalIso`, `addDaysIso`)
- Scripts de release: `npm run release:{patch,minor,major}`.
- CI passa a executar `npm test`.

### Alterado
- `.gitignore`: adicionada a pasta `coverage/`.

## [0.1.0] — baseline

Estado inicial do assistente (pré-integração): bot WhatsApp (Baileys) + opencode serve + painel admin (`:3000`) + chat web (`:4000`), com agendamento, memória de longo prazo, notificações, persona editável e CI/CD inicial.
