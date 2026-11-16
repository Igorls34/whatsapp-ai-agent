> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 💬 Chat Web (página para portfólio)

Permite conversar com o **mesmo agente** do WhatsApp por uma **página web** — o cérebro é idêntico (mesmo `agent.js`, mesma persona, mesma agenda e memória). Útil como **prova viva** no portfólio: o visitante conversa com o bot sem depender de WhatsApp.

## Como funciona

```
Visitante (navegador)
   → GET /api/start      (gera a sessão web_<id>)
   → POST /api/chat      ({sessionId, message})
   → o MESMO agent.js    (contexto + catálogo + ferramentas)
   → opencode :4096      (LLM)
   → resposta (texto, dividida em ||| como no WhatsApp)
```

- O identificador do cliente é uma sessão `web_<uuid>` (guardada no `localStorage` do navegador) — a memória de longo prazo e o resumo continuam funcionando por visitante.
- **Sem boas-vindas aqui**: a página mostra só o chat. O material de boas-vindas (`WELCOME_TEXT`/`WELCOME_IMAGE`) é exclusivo do WhatsApp.
- A página divide a resposta em bolhas quando o modelo usa o separador `|||`, igual ao WhatsApp.

## Rodar

```bash
npm start
# abra http://127.0.0.1:4000
```

- O chat é servido pelo **app único** (mesma porta do painel e do QR); `npm run web` sobe só o chat, na `WEB_PORT`, para desenvolvimento.
- Precisa do `opencode serve` no ar (`npm run serve`, outro terminal).
- Quando o opencode cai, o chat responde com o aviso padrão do bot.

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `HTTP_HOST` | `127.0.0.1` | Endereço para ouvir. `0.0.0.0` expõe na rede (para colocar no portfólio, prefira HTTPS à frente). |
| `HTTP_PORT` | `4000` | Porta única do app (chat em `/`, painel em `/admin`, QR em `/qr`). |
| `WEB_HOST` / `WEB_PORT` | `127.0.0.1` / `4000` | Só no modo avulso (`npm run web`). |

## O que NÃO existe aqui (vs. WhatsApp)

- **Ferramentas que dependem do WhatsApp** (`enviar_imagem`) respondem com aviso amigável ao modelo — o chat vira texto puro. **Notificações** (agendamento/emergência) funcionam: vão para a outbox e saem quando o WhatsApp do app estiver conectado.
- **Agendamentos**: funcionam normalmente (o Igor é notificado por email/WhatsApp, conforme config).
- **Rate limit** por sessão: ~12 mensagens/minuto (`429`) — evita abuso em site público.
- **Bloqueio por abuso**: comportamento abusivo chama a ferramenta `bloquear_cliente` e o chat fica **indisponível por 1h** (retorno `indisponivel: true`). Em tudo isso, os **gargalos** também valem aqui (ver [backpressure](backpressure.md)).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Página do chat (HTML único, zero dependências) |
| `GET` | `/api/start?sessionId=` | Retorna `{ sessionId, atendente }` e registra o visitante; `indisponivel: true` se a sessão estiver bloqueada (1h) |
| `POST` | `/api/chat` | Envia `{ sessionId, message }` → `{ ok, reply, partes }`; `429` se acima do limite/minuto; `503` se em excesso (`WEB_MAX_CONCURRENT`) ou timeout (`WEB_TIMEOUT_MS`) |

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/http/routes/chat.js` | Rotas do chat (página + API) montadas no app único |
| `src/web/server.js` | Modo avulso do chat (dev, porta `WEB_PORT`) |
| `src/web/index.html` | Página do chat (HTML/CSS/JS embutidos) |

## Embutir no portfólio

O API responde com **CORS aberto** (`*`), então dá para o chat ser consumido por outro site. Duas opções:

1. **Iframe**: incluir `http://SEU_SERVIDOR:4000` dentro da sua página (mais simples).
2. **Widget próprio**: o seu site chama `POST /api/chat` com `{sessionId, message}` e desenha as bolhas do seu jeito.

> [!TIP]
> Expondo publicamente (`WEB_HOST=0.0.0.0`), proteja atrás de HTTPS (nginx/Cloudflare). O bot continua podendo ser atingido por qualquer pessoa — o rate limit só limita o ritmo; a persona, as regras (`VALORES NUNCA`) e o bloqueio por abuso (`bloquear_cliente`) seguem valendo aqui também.