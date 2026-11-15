# Changelog

Todas as mudanças relevantes do projeto, em ordem cronológica (da mais recente para a mais antiga). Formato inspirado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionado com [SemVer](https://semver.org/lang/pt-BR/).

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
