> 📚 **[Índice](FEATURES.md)** · [README](../README.md) · [Plano de integração](PLANO_INTEGRACAO.md)

# 🏷️ Versionamento

Como o projeto é versionado e lançado. Regras simples, sem dependências extras.

## Semver

Versões no formato `MAJOR.MINOR.PATCH` (SemVer), refletidas em `package.json` e em **tags** `vX.Y.Z`:

| Incremento | Quando |
|---|---|
| `patch` | Correção de bug / ajuste pequeno, sem mudança de comportamento público |
| `minor` | Nova funcionalidade ou fase do plano de integração (compatível) |
| `major` | Mudança incompatível / reescrita (ex.: `v1.0.0` quando o sistema unificado estabilizar) |

## Branches

| Branch | Papel |
|---|---|
| `master` | **Tronco deployável** — CI e CD (deploy no homesrv) apontam pra cá. Sempre "verde". |
| `feat/fase-N-...` | Cada fase do plano (ver [PLANO_INTEGRACAO.md](PLANO_INTEGRACAO.md)) em uma branch própria. |
| `feat/<algo>` | Branches de feature avulsas (ex.: `feat/persona`). |
| `public` | Variante com persona genérica (identidade pública). |

Fluxo: `feat/fase-N-...` → PR → merge em `master` → tag `vX.Y.Z` → deploy automático.

## Commits (Conventional Commits)

Prefixo no título do commit:

| Prefixo | Uso |
|---|---|
| `feat:` | nova funcionalidade |
| `fix:` | correção |
| `refactor:` | mudança de estrutura sem alterar comportamento |
| `docs:` | documentação |
| `test:` | testes |
| `chore:` | build, scripts, config, CI/CD |

Ex.: `feat: extrair core/brain compartilhado`, `refactor: unificar servidor HTTP`.

## Release (lançar uma versão)

```bash
# patch → 0.2.1 · minor → 0.3.0 · major → 1.0.0
npm run release:patch
npm run release:minor
npm run release:major
```

Cada comando **bumpa** `package.json`/`package-lock.json`, cria o commit e a tag `vX.Y.Z`. Depois:

```bash
git push origin master --follow-tags
```

O push em `master` dispara o deploy no homesrv automaticamente (runner self-hosted).

> Mantenha o [CHANGELOG.md](../CHANGELOG.md) atualizado com o que entrou em cada versão — ele é o "índice" humano das mudanças.

## CI/CD

- **CI** (`ci.yml`): roda em push/PR — `npm ci`, `node --check` em todos os `.js` e `npm test` (testes `node:test`).
- **Deploy** (`deploy.yml`): roda em push em `master` (e manual) via runner self-hosted — `deploy/deploy.sh` (git pull → `npm ci` → restart → healthcheck com rollback).

> Rollback do `deploy.sh` usa o commit anterior; a partir da Fase 5, passará a usar **tags/releases** como ponto de rollback.
