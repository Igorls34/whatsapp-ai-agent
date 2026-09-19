# Guia do Operador (Igor)

Como rodar, parar e acompanhar o bot no dia a dia.

> Índice de funcionalidades (cada uma com página dedicada): [FEATURES.md](FEATURES.md)

## Termos

- **Bot** — o processo Node que conecta no WhatsApp da empresa e responde os clientes. Roda com `npm run start:bot`.
- **opencode serve** — servidor local de IA (LLM). O bot **precisa** dele para responder. Roda com `npm run serve` (porta 4096).
- **Painel admin** — página local em `http://127.0.0.1:3000` (dashboard, serviços, agenda, clientes). Roda com `npm run admin`.
- **Chat web** — página local em `http://127.0.0.1:4000` (conversa no navegador). Roda com `npm run web`.
- **Supervisor (`npm start`)** — sobe **todos** os componentes acima (IA, bot, painel e chat web) juntos, e reinicia cada um sozinho se cair (recomendado para deixar rodando).

## Iniciar o bot

**Modo plug-and-play (`npm start`)** — cuida de tudo sozinho:

```bash
npm start
```

O supervisor checa se o `opencode serve` responde em `http://127.0.0.1:4096/global/health`; se não, sobe ele como processo filho, espera ficar saudável e então inicia o bot, o painel admin (:3000) e o chat web (:4000). Se qualquer um dos quatro cair, ele religa sozinho (com backoff). Use `Ctrl+C` para encerrar todos.

**Ou manualmente, em 2 terminais:**

1. Garanta que o `opencode serve` está no ar:

```bash
npm run serve
```

Você pode checar se está funcionando:

```powershell
Invoke-RestMethod http://127.0.0.1:4096/global/health
# → { "healthy": true, "version": "..." }
```

2. Inicie o bot:

```bash
npm run start:bot
```

3. **Na primeira conexão**, escaneie o QR code exibido no terminal com o WhatsApp da empresa (Ajustes → Aparelhos conectados → Conectar aparelho). Depois disso a sessão fica salva em `.sessions/`.

> O bot já faz auto-seed da agenda no start e a cada 12h — não precisa rodar o seed manualmente.

## Parar o bot

- Pressione `Ctrl+C` no terminal onde ele roda, **ou** encerre o processo `node` que executa `src/index.js`.
- Parar o `opencode serve` não "desliga" o WhatsApp, mas o bot passa a responder com a mensagem de erro ("não consegui responder…").

## Ver os logs

- **Terminal do bot** — mensagens recebidas/enviadas (`[msg]...`), boas-vindas (`[welcome]...`), agendamentos (`[notif]...`), erros de LLM (`[llm]...`), segurança/bloqueios (`[seguranca]...`) e entrega de avisos pendentes (`[notif] aviso entregue...`).
- Rodando em segundo plano, os logs são gravados na pasta **`logs/`** (`bot.log`, `admin.log`, `opencode-serve.log`).
- Para rodar redirecionando para um arquivo:

```bash
npm start > logs\bot.log 2>&1
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Bot responde "não consegui responder 😅" | `opencode serve` fora do ar | suba o servidor (passo 1) |
| Mensagem chega mas bot não responde | conexão com o WhatsApp caiu e não reconectou | reinicie o bot |
| QR pedido de novo | sessão apagada/corrompida em `.sessions/` | escaneie de novo (back-up da sessão em `.sessions-backup/`) |
| Email de agendamento não chega | SMTP inválido/senha de app | veja `docs/SMTP.md` |
| Cliente fala de horário indisponível | agenda lotada | confira `agenda` no banco (ver `docs/AJUSTES.md`) |
| Cliente abusivo sumiu do atendimento | foi bloqueado (permanente no WhatsApp, 1h no web) | log `[seguranca] chat fechado`; para desbloquear, limpe `chat_fechado` em `clientes` |

## Onde os dados ficam

- **Banco de dados:** `data/agent.db` (clientes, agenda, serviços).
- **Sessão WhatsApp:** `.sessions/` (credenciais — não versionar no git).
- **Imagens/GIFs:** `assets/imagens/` + `assets/imagens/manifest.json`.
- **Configuração:** `.env` (segredos) e `src/config.js` (defaults).