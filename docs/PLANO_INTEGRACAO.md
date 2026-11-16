> 📚 **[Índice](FEATURES.md)** · [README](../README.md) · [Versionamento](VERSIONAMENTO.md)

# 🧩 Plano de integração — sistema único

Plano para transformar o projeto de "vários processos remendados" em **um único sistema coerente** com a proposta do projeto: um assistente 24/7 **agnóstico de canal**, com um só cérebro, um só banco, um só servidor HTTP e uma operação enxuta.

> Status: **Fases 0-3 concluídas** (v0.5.0) — sistema roda com um cérebro, uma porta HTTP e notificações em processo (outbox persistente). Próxima: **Fase 4** (operação/single service). Veja o [CHANGELOG](../CHANGELOG.md) para o histórico de releases.

---

## 1. Diagnóstico

O código funciona, mas a arquitetura não reflete a proposta de "um sistema". Hoje o `npm start` sobe **4 processos** (`start.js`) e o deploy acrescentou um **5º** (servidor de QR ad-hoc):

| Processo | Porta | O que faz |
|---|---|---|
| `opencode serve` | `4096` | Cérebro (IA) — runtime externo |
| Bot (`src/index.js`) | — (socket) | WhatsApp + auto-seed + dreno da fila de avisos (polling 30s) |
| Painel (`src/admin/server.js`) | `3000` | CRUD de serviços/agenda/persona (HTTP) |
| Chat web (`src/web/server.js`) | `4000` | Chat no navegador (HTTP) |
| *QR server (Python, ad-hoc)* | `8090` | Página de pareamento — **fora do projeto** |

### Pontos de fragmentação

1. **Cérebro duplicado 3×** — `createAgent`, `createToolExecutor`, `createSummarizer`, `createImageService`, `createConversationMemory` e `createLocalOpencodeAdapter` são instanciados em `src/index.js`, `src/web/server.js` e `src/admin/server.js`.
2. **Dois servidores HTTP artesanais** — `admin/server.js` e `web/server.js` duplicam `json`, `readBody`, roteamento e o setup do banco. Sem router compartilhado, sem `/health`.
3. **Comunicação entre processos via polling de banco** — a tabela `avisos_pendentes` é o workaround para "processo sem socket do WhatsApp"; o bot faz polling a cada 30s (`src/index.js`).
4. **3 mecanismos de QR desconexos** — terminal (`qrcode-terminal`), popup Windows (`src/whatsapp/client.js`) e o servidor Python `:8090`.
5. **Abstração de canal pela metade** — o parâmetro `canal` existe, mas cada canal re-monta o cérebro inteiro em vez de compartilhá-lo.
6. **Operação/deploy espalhados** — o healthcheck do deploy só olha `:4096/global/health`; cada porta nova exige liberar no `ufw` (foi o bug do QR).

---

## 2. Arquitetura alvo

```
Processo único (Node)
├── bootstrap        → config + banco + repos  (UMA conexão SQLite)
├── core/brain       → adapter + agent + executor + memory + summarizer
│                      + notifier + imageService  (UMA instância, compartilhada)
├── conversation     → orquestrador de turno (extraído do messageHandler)
├── channels         → whatsapp (Baileys)  e  web (HTTP)  → mesmo cérebro
├── http (UMA porta) → /admin  ·  /chat  ·  /qr  ·  /health
└── scheduler        → auto-seed + flush de notificações (em memória)

opencode serve (:4096) — permanece externo (outro runtime; é o "cérebro").
```

**Ganhos:**

- **Uma porta só** para abrir no firewall (o QR passa a ser rota do próprio app).
- **Um banco só** (uma conexão, um escritor — melhor que as 3 conexões WAL atuais).
- **Notificação em processo** (adeus `avisos_pendentes` + polling).
- **QR nativo** (adeus servidor Python + popup Windows + porta extra).
- **Multi-canal real** (o `canal` vira apenas mais um transporte — `multicanal.md`).

---

## 3. Plano em fases

Regra de ouro: **toda fase termina com `npm test` e CI verdes e sem regressão funcional** — cada uma é independentemente "shippable" e reversível (rollback do `deploy.sh`).

| Fase | Objetivo | Entregável | Tag |
|---|---|---|---|
| **0** | Baseline: versionamento + testes mínimos | `CHANGELOG.md`, `docs/VERSIONAMENTO.md`, testes `node:test`, scripts de release, CI com `npm test` | `v0.2.0` |
| **1** | Extrair `core/brain` + `conversation` (refactor sem mudar comportamento) | `src/core/`, `src/conversation/`; `index.js` e `web` usam o cérebro único | `v0.3.0` |
| **2** | Unificar HTTP: um servidor, uma porta | `src/http/` com `/admin`, `/chat`, `/qr`, `/health`; remove QR `:8090` e popup | `v0.4.0` |
| **3** | Eliminar a fila `avisos_pendentes` (notificação em processo) | Notifier compartilhado com o socket; flush imediato (com persistência p/ restart) | `v0.5.0` |
| **4** | Consolidação operacional (single service + deploy coerente) | `start.js` fino; systemd roda 1 app; `deploy.sh` usa `/health`; docs atualizadas | `v0.6.0` |
| **5** | *(roadmap)* Deploy por tag + settings dinâmicos (`FUTURO.md`) | site, contatos de notif., pausas/feriados via painel | `v0.7.0` → `v1.0.0` |

### Detalhes por fase

**Fase 0 — Baseline e disciplina (esta)**
- Limpar/refinar `.gitignore`; adicionar `CHANGELOG.md` e `docs/VERSIONAMENTO.md`.
- Semver + conventional commits + tags (`vX.Y.Z`).
- Testes unitários mínimos com `node:test` (sem dependência nova): `toolProtocol`, `agent` (catálogo), `repositories` (datas).
- Scripts `npm run release:{patch,minor,major}`.

**Fase 1 — Núcleo compartilhado**
- Criar `createBrain()` (factory que monta db+repos+adapter+agent+executor+memory+summarizer+imageService+notifier **uma vez**).
- Criar `src/conversation/` extraindo a lógica do `messageHandler` para um orquestrador independente de canal.
- Refatorar `src/index.js` e `src/web/server.js` para consumir `createBrain()`. Comportamento idêntico.

**Fase 2 — HTTP unificado**
- Servidor único com rotas montadas: `/admin/*`, `/chat/*`, `/qr`, `/health`.
- QR como rota nativa (a imagem é gerada em memória a partir do evento do Baileys).
- Remover o servidor Python `:8090` e o popup Windows.

**Fase 3 — Notificação em processo**
- O notifier passa a usar o socket compartilhado; sem polling de `avisos_pendentes`.
- Manter persistência da fila apenas para sobreviver a restart (flush no boot quando o socket abrir).

**Fase 4 — Operação**
- `start.js` vira um supervisor fino (app + opencode serve).
- `deploy.sh` passa a bater no `/health` (que checa opencode + banco + WhatsApp).
- Atualizar README/REFERENCIA/OPERACAO para a nova topologia de porta única.

**Fase 5 — Roadmap**
- Deploy por tag/release (em vez de `reset --hard origin/master`).
- Settings dinâmicos do painel (site, contatos de notificação, pausas/feriados) — itens de `FUTURO.md`.

---

## 4. Versionamento

Estratégia completa em [VERSIONAMENTO.md](VERSIONAMENTO.md). Resumo:

- **Branches:** `master` = tronco deployável (CI + CD apontam pra ele). Cada fase = branch `feat/fase-N-...` → PR → merge.
- **Semver + tags:** `v0.2.0`, `v0.3.0`, … cada fase sobe `minor`; `v1.0.0` quando o sistema unificado estiver estável.
- **Conventional Commits:** `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- **Release:** `npm run release:minor` (bump + tag + commit).

> ⚠️ `opencode serve` fica **fora** da unificação (é binário externo). "Sistema único" = o app Node vira **um processo só**; o opencode continua sendo o cérebro em `:4096`.
