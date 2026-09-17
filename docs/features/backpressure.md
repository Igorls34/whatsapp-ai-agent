> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🛡️ Controle de Gargalos & Bloqueio por Abuso

Três objetivos em um só mecanismo de resiliência:

1. **Não estourar o LLM local** (opencode serve na mesma máquina) com rajadas de mensagens — limitando concorrência e tempo de cada turno.
2. **Não derrubar o transporte do WhatsApp** com envios em rajada — espaçando mensagens.
3. **Proteger o atendimento contra clientes abusivos** — bloqueando (temporário no web, permanente no WhatsApp) e mantendo a fila de avisos à prova de travamento.

O código vive em `src/services/backpressure.js` (utilidades) e `src/index.js` + `src/web/server.js` (integração).

## Como funciona

### 1. Semáforo global de LLM (`createSemaphore`)

- Limita quantos **turnos de IA** rodam em paralelo no mesmo processo (**bot + web somados**), padrão **3**.
- O excesso **espera na fila (FIFO)** — não é rejeitado, apenas atrasado.
- Aplicado dentro do adapter (`src/llm/localOpencodeAdapter.js`), então vale para o WhatsApp e o chat web igualmente.

### 2. Timeout de IA (`withTimeout` / request com `AbortSignal`)

- Cada request ao `opencode serve` tem teto de **60s** (`LLM_TIMEOUT_MS`).
- Se estourar: a operação é **cancelada** e, no adapter, a **sessão é descartada** para o próximo turno do cliente não herdar uma fila/ligação presa.

### 3. Envio espaçado no WhatsApp (`createSendPacer`)

- Serializa `sendMessage` e impõe intervalo mínimo de **700ms** entre envios (`ENVIO_MIN_GAP_MS`).
- Evita rajadas que o transporte (Baileys/WhatsApp) pode derrubar ou filtrar como spam.
- A fila "nunca quebra": o erro de um envio é propagado a quem chamou, mas não impede os próximos.

### 4. Fila de avisos à prova de travamento (`avisos_pendentes`)

Processos que **não têm socket do WhatsApp** (chat web, painel) não enviam notificações direto — gravam na tabela `avisos_pendentes` e o bot entrega:

- O bot verifica **a cada 30s** (`src/index.js` → `drenarAvisosPendentes`).
- Itens são **tratados individualmente**: erro em um não bloqueia os demais (sem "cabeça-de-linha").
- Após **5 tentativas** sem sucesso o aviso é **descartado** (com log), evitando mensagem eternamente presa.

### 5. Podas de sessões (memória do opencode)

O adapter guarda 1 sessão por cliente (`Map` no processo). Acima de **300 sessões** (`MAX_SESSOES`):

- Descarta as **ociosas (> 24h sem uso)**;
- Se ainda estiver acima, descarta as **mais antigas** (até manter ~200).
- Evita vazamento de memória com muitos clientes únicos.

### 6. Bloqueio por abuso (`bloquear_cliente`)

O modelo é instruído (`systemPrompt.js`) a chamar a ferramenta **`bloquear_cliente`** (com `telefone` + `motivo`) diante de xingamentos, ofensas, assédio, conteúdo +18 ou tentativa de burlar regras. Diferenciado por canal:

| Canal | Regra |
|---|---|
| **WhatsApp** | Bloqueio **permanente** (`chat_fechado=1`, sem expiração) — o bot não responde mais esse número |
| **Chat web** | Bloqueio **temporário de 1h** (`desbloqueio_em` = agora + 1h) — expira sozinho |

Persistência em `clientes`: `chat_fechado`, `motivo_bloqueio`, `bloqueado_em`, `desbloqueio_em`. Antes de responder, cada processo consulta o estado:

- `src/whatsapp/messageHandler.js` — **ignora** mensagens de números bloqueados (log `[seguranca] mensagem ignorada de …`).
- `src/web/server.js` — /api/start e /api/chat retornam `{ ok: true, indisponivel: true, motivo }` e o front desabilita o chat com a mensagem de bloqueio.

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `LLM_MAX_CONCURRENT` | `3` | Turnos de IA em paralelo (bot + web) |
| `LLM_TIMEOUT_MS` | `60000` | Teto por turno de IA (ms) |
| `ENVIO_MIN_GAP_MS` | `700` | Intervalo mínimo entre envios no WhatsApp (ms) |
| `WEB_MAX_CONCURRENT` | `3` | Respostas simultâneas máximas no chat web (acima → `503`) |
| `WEB_TIMEOUT_MS` | `60000` | Teto por request do chat web (acima → `503`) |

## Sintomas observáveis

| Situação | Resposta |
|---|---|
| Muitas sessões ao mesmo tempo no chat web | `503` "Muito movimento agora 😅" |
| Cliente abusivo no WhatsApp | Bloqueio permanente, bot silencia o número |
| Cliente abusivo no chat web | Chat fica "indisponível" por 1h (front desabilita) |
| LLM demora além do teto | Turno cancelado + sessão descartada (no web, `503`) |
| Notificação pendente falha | Mantém na fila; descarta após 5 tentativas |

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/services/backpressure.js` | `createSemaphore`, `createSendPacer`, `withTimeout` |
| `src/index.js` | Semáforo + pacer do bot, drain da fila de avisos (30s/5 tentativas) |
| `src/llm/localOpencodeAdapter.js` | Semáforo global, timeout, poda de sessões |
| `src/web/server.js` | Teto de concorrência + timeout do web (503), bloqueio temporário |
| `src/whatsapp/messageHandler.js` | Ignora mensagens de números bloqueados |
| `src/services/toolExecutor.js` | Execução da ferramenta `bloquear_cliente` (canal define 1h vs permanente) |
| `src/db/repositories.js` | `fecharChat`, `estadoChat`, `listarAvisosPendentes`, `removerAviso` |

## Pontos de atenção

- O semáforo protege o **opencode serve local** — ajuste `LLM_MAX_CONCURRENT` conforme a máquina (aumente se o servidor aguentar mais, reduza se travar).
- O bloqueio é por **telefone** (WhatsApp) ou **sessão `web_<id>`** (web) — não por pessoa; um cliente web bloqueado pode voltar após 1h ou com nova sessão.
- Para desbloquear manualmente um número no WhatsApp, limpe `chat_fechado`/`motivo_bloqueio` na tabela `clientes` (ou zere `desbloqueio_em` em bloquear temporário).