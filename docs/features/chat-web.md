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
npm run web
# abra http://127.0.0.1:4000
```

- Precisa do `opencode serve` no ar (`npm run serve`, outro terminal).
- Quando o opencode cai, o chat responde com o aviso padrão do bot.

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `WEB_HOST` | `127.0.0.1` | Endereço para ouvir. `0.0.0.0` expõe na rede (para colocar no portfólio, prefira HTTPS à frente). |
| `WEB_PORT` | `4000` | Porta do chat. |

## O que NÃO existe aqui (vs. WhatsApp)

- **Ferramentas que dependem do WhatsApp** (`enviar_imagem`, notificações por WhatsApp, emergência via WhatsApp) respondem com aviso amigável ao modelo — o chat vira texto puro.
- **Agendamentos**: funcionam normalmente (o Igor é notificado por email/WhatsApp, conforme config).
- **Rate limit** simples por sessão: ~12 mensagens/minuto (evita abuso em site público).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Página do chat (HTML único, zero dependências) |
| `GET` | `/api/start?sessionId=` | Retorna `{ sessionId }` e registra o visitante |
| `POST` | `/api/chat` | Envia `{ sessionId, message }` → `{ reply, partes }` |

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/web/server.js` | Servidor HTTP + API + monta os mesmos componentes do bot |
| `src/web/index.html` | Página do chat (HTML/CSS/JS embutidos) |

## Embutir no portfólio

O API responde com **CORS aberto** (`*`), então dá para o chat ser consumido por outro site. Duas opções:

1. **Iframe**: incluir `http://SEU_SERVIDOR:4000` dentro da sua página (mais simples).
2. **Widget próprio**: o seu site chama `POST /api/chat` com `{sessionId, message}` e desenha as bolhas do seu jeito.

> [!TIP]
> Expondo publicamente (`WEB_HOST=0.0.0.0`), proteja atrás de HTTPS (nginx/Cloudflare). O bot continua podendo ser atingido por qualquer pessoa — o rate limit evita abuso, mas a persona e as regras (`VALORES NUNCA`) seguem valendo aqui também.