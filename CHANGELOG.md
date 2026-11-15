# Changelog

Todas as mudanças relevantes do projeto, em ordem cronológica (da mais recente para a mais antiga). Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionado com [SemVer](https://semver.org/lang/pt-BR/).

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
