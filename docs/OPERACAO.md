# Guia do Operador (Igor)

Como rodar, parar, acompanhar e atualizar o sistema no dia a dia.

> Índice de funcionalidades (cada uma com página dedicada): [FEATURES.md](FEATURES.md)

## Termos

- **App (sistema único)** — **um processo Node** que conecta no WhatsApp, responde os clientes e serve todas as páginas web. Roda com `npm start` (ou `node start.js`).
- **opencode serve** — servidor local de IA (LLM). O app **precisa** dele para responder. Roda com `npm run serve` (porta `4096`).
- **Supervisor (`npm start`)** — sobe o `opencode serve` (se ainda não estiver no ar) + o app, e reinicia cada um sozinho se cair (recomendado).
- **Modos avulsos** — `npm run admin` (painel sozinho na `:3000`) e `npm run web` (chat sozinho na `:4000`) existem só para desenvolvimento/depuração. Em produção use o app único.

## Uma porta, tudo junto

Com o app no ar (`HTTP_HOST`/`HTTP_PORT`, padrão `127.0.0.1:4000`):

| URL | O que é |
|---|---|
| `http://127.0.0.1:4000/` | Chat web (mesmo agente do WhatsApp) |
| `http://127.0.0.1:4000/admin` | Painel: dashboard, serviços, agenda, clientes, persona |
| `http://127.0.0.1:4000/qr` | Pareamento do WhatsApp (QR atual) |
| `http://127.0.0.1:4000/health` | Healthcheck (banco, IA, WhatsApp e avisos pendentes) |

Por padrão o app escuta **só em localhost**. Para parear o WhatsApp a partir de outro aparelho, veja [.env.example](../.env.example) (`HTTP_HOST=0.0.0.0` + `ADMIN_TOKEN`) ou prefira um túnel/VPN.

## Iniciar

**Modo plug-and-play (recomendado):**

```bash
npm start
```

O supervisor checa se o `opencode serve` responde em `http://127.0.0.1:4096/global/health`; se não, sobe ele como processo filho, espera ficar saudável e então inicia o **app único** (WhatsApp + HTTP). Se qualquer um dos dois cair, ele religa sozinho (com backoff). `Ctrl+C` encerra tudo.

**Ou manualmente, em 2 terminais:**

1. Garanta que o `opencode serve` está no ar:

```bash
npm run serve
```

```powershell
Invoke-RestMethod http://127.0.0.1:4096/global/health
# → { "healthy": true, "version": "..." }
```

2. Inicie o app:

```bash
npm run start:bot
```

> O app já faz auto-seed da agenda no start e a cada 12h — não precisa rodar o seed manualmente.

## Conectar o WhatsApp (primeira vez ou sessão perdida)

No start, o QR aparece **no terminal** e também em `http://127.0.0.1:4000/qr`.

1. Abra o WhatsApp no celular do responsável.
2. **Ajustes → Aparelhos conectados → Conectar um aparelho**.
3. Aponte a câmera para o QR (terminal ou página `/qr`).

A sessão fica salva em `.sessions/` — não precisa escanear de novo. Se o QR expirar, a página se atualiza sozinha (o código é gerado em memória; não existe mais servidor Python nem popup do Windows).

## Parar

- `Ctrl+C` no terminal do `npm start`, **ou** `systemctl --user stop whatsapp-ai-agent` no servidor, **ou** encerre o processo `node` do app.
- Parar o `opencode serve` não "desliga" o WhatsApp, mas o app passa a responder com a mensagem de erro ("não consegui responder…").

## Ver os logs

- **Terminal do app** — mensagens (`[msg]`), boas-vindas (`[welcome]`), agendamentos (`[notif]`), falhas de IA (`[llm]`), bloqueios (`[seguranca]`) e entrega de notificações (`[notif] aviso entregue…`).
- **No servidor (systemd)** — `journalctl --user -u whatsapp-ai-agent -f`.
- Para rodar redirecionando para um arquivo:

```bash
npm start > logs/bot.log 2>&1
```

## Healthcheck

```bash
curl -s http://127.0.0.1:4000/health
```

Resposta (resumo): `ok`, `db.ok`, `llm.ok`, `whatsapp.conectado`/`qrPendente` e `notificacoes.pendentes` (tamanho da outbox). O `/health` responde **200** quando o processo e o banco estão de pé; **503** se o banco falhar. Sem WhatsApp pareado ou sem `opencode`, o app segue no ar (aparece `conectado: false` / `llm.ok: false`) — não reinicie por isso.

## Deploy no servidor (homesrv)

- O deploy roda em `/home/igordev/apps/whatsapp-ai-agent` como unit **systemd de usuário** (`whatsapp-ai-agent`), sem `sudo`.
- `deploy/deploy.sh`: `git reset --hard origin/master` → `npm ci` → `systemctl --user restart whatsapp-ai-agent` → espera o `/health` responder → **rollback automático** para o commit anterior se falhar.
- Modelo da unit: [`deploy/whatsapp-ai-agent.service`](../deploy/whatsapp-ai-agent.service).
- Só push em `master` dispara o deploy (push de branch roda apenas o CI).

```bash
systemctl --user status whatsapp-ai-agent
journalctl --user -u whatsapp-ai-agent -n 100 --no-pager
```

Se o `opencode serve` já roda como **outra** unit no servidor, troque o `ExecStart` da unit do app para `node src/index.js` (o app não precisa do supervisor) e remova `OPENCODE_*` duplicado.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| App responde "não consegui responder 😅" | `opencode serve` fora do ar | suba o servidor (passo 1) |
| Mensagem chega mas o bot não responde | conexão com o WhatsApp caiu e não reconectou | veja `/health` e os logs; reinicie o app |
| QR pedido de novo | sessão apagada/corrompida em `.sessions/` | escaneie de novo em `/qr` (backup em `.sessions-backup/`) |
| `/admin` retorna 401 | `ADMIN_TOKEN` definido | envie o token (abaixo) ou remova a variável |
| Email de agendamento não chega | SMTP inválido/senha de app | veja `docs/SMTP.md` |
| Aviso de agendamento atrasado | WhatsApp desconectado no momento do envio | a outbox entrega sozinha quando conectar; veja `notificacoes.pendentes` no `/health` |
| Cliente fala de horário indisponível | agenda lotada | confira `agenda` no banco (ver `docs/AJUSTES.md`) |
| Cliente abusivo sumiu do atendimento | foi bloqueado (permanente no WhatsApp, 1h no web) | log `[seguranca] chat fechado`; para desbloquear, limpe `chat_fechado` em `clientes` |

```bash
# painel com ADMIN_TOKEN
curl -H "Authorization: Bearer SEU_TOKEN" http://127.0.0.1:4000/api/dashboard
```

## Onde os dados ficam

- **Banco de dados:** `data/agent.db` (clientes, agenda, serviços, persona, avisos pendentes).
- **Sessão WhatsApp:** `.sessions/` (credenciais — não versionar no git).
- **Imagens/GIFs:** `assets/imagens/` + `assets/imagens/manifest.json`.
- **Configuração:** `.env` (segredos) e `src/config.js` (defaults).
