# Guia do Operador (Igor)

Como rodar, parar e acompanhar o bot no dia a dia.

## Termos

- **Bot** — o processo Node que conecta no WhatsApp da empresa e responde os clientes. Roda com `npm start`.
- **opencode serve** — servidor local de IA (LLM). O bot **precisa** dele para responder. Roda com `npm run serve` (porta 4096).

## Iniciar o bot

1. Garanta que o `opencode serve` está no ar:

```bash
opencode serve --port 4096
```

Você pode checar se está funcionando:

```powershell
Invoke-RestMethod http://127.0.0.1:4096/global/health
# → { "healthy": true, "version": "..." }
```

2. Inicie o bot:

```bash
npm start
```

3. **Na primeira conexão**, escaneie o QR code exibido no terminal com o WhatsApp da empresa (Ajustes → Aparelhos conectados → Conectar aparelho). Depois disso a sessão fica salva em `.sessions/`.

> O bot já faz auto-seed da agenda no start e a cada 12h — não precisa rodar o seed manualmente.

## Parar o bot

- Pressione `Ctrl+C` no terminal onde ele roda, **ou** encerre o processo `node` que executa `src/index.js`.
- Parar o `opencode serve` não "desliga" o WhatsApp, mas o bot passa a responder com a mensagem de erro ("não consegui responder…").

## Ver os logs

- **Terminal do bot** — mensagens recebidas/enviadas (`[msg]...`), boas-vindas (`[welcome]...`), agendamentos (`[notif]...`), erros de LLM (`[llm]...`).
- Se rodar redirecionando para um arquivo:

```bash
npm start > bot.log 2>&1
```

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| Bot responde "não consegui responder 😅" | `opencode serve` fora do ar | suba o servidor (passo 1) |
| Mensagem chega mas bot não responde | conexão com o WhatsApp caiu e não reconectou | reinicie o bot |
| QR pedido de novo | sessão apagada/corrompida em `.sessions/` | escaneie de novo (back-up da sessão em `.sessions-backup/`) |
| Email de agendamento não chega | SMTP inválido/senha de app | veja `docs/SMTP.md` |
| Cliente fala de horário indisponível | agenda lotada | confira `agenda` no banco (ver `docs/AJUSTES.md`) |

## Onde os dados ficam

- **Banco de dados:** `data/agent.db` (clientes, agenda, serviços).
- **Sessão WhatsApp:** `.sessions/` (credenciais — não versionar no git).
- **Imagens/GIFs:** `assets/imagens/` + `assets/imagens/manifest.json`.
- **Configuração:** `.env` (segredos) e `src/config.js` (defaults).