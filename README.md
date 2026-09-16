# WhatsApp AI Agent — Igor Dev

Assistente virtual 24/7 do **Igor Laurindo (Igor Dev)** para WhatsApp. Atende clientes, apresenta os serviços do Igor (suporte/instalação **e** desenvolvimento de software), agenda reuniões na agenda dele com regras de horário de trabalho, e mantém memória de longo prazo de cada cliente em SQLite.

O "cérebro" é o **próprio opencode executando localmente** (modelo gratuito via `opencode serve`) — sem depender de OpenAI ou API keys para começar.

---

## Funcionalidades

- **Atendimento 24/7** no WhatsApp via Baileys, com fallback para reconexão automática (socket sempre atualizado).
- **Catálogo de serviços** em SQLite (tabela `servicos`): o LLM apresenta **apenas** os serviços cadastrados (nome, descrição, preço). Serviço fora do catálogo → sugere reunião com o Igor (desenvolvimento sob medida).
- **Agendamento inteligente** com agenda bloqueada nos horários de trabalho do Igor:
  - Seg–Qui: bloqueado 12h–21h · Sex: 10h–19h · Sáb: 8h–14h · Dom: livre.
  - Janela de agendamento 07h–00h, slots de hora em hora.
- **Memória de longo prazo** por cliente (SQLite) + histórico volátil por sessão.
- **Notificação no agendamento:** aviso automático para o Igor via **WhatsApp** e **email (Gmail SMTP)** com os dados da reunião.
- **Emergências:** ferramenta `notificar_emergencia` avisa o Igor (WhatsApp ou log) quando um cliente preciute atendimento humano.
- **Boas-vindas** para cliente novo ou inativo (+24h), com GIF/imagem (opcional) ou só texto.
- **Mensagens múltiplas:** o LLM pode quebrar a resposta em até 3 mensagens (`|||`) com 1,5s de intervalo.
- **Edge cases:** mídia (imagem/vídeo/áudio/sticker) é respondida pedindo texto; banco offline cai num atendimento genérico; agenda cheia tem resposta amigável.

---

## Arquitetura

```
WhatsApp (Baileys)
   │  mensagem recebida (texto/mídia)
   ▼
[src/whatsapp/messageHandler.js]   fluxo RAG:
  1. extrai telefone (suporte a jid @lid)
  2. trata mídia / boas-vindas / memória persistente
  3. injeta catálogo de serviços + imagens + resumo do cliente no system prompt
  4. chama o agente (LLM) → resposta (pode ser múltiplas mensagens)
  5. periodicamente regrava o resumo no banco
   ▼
[src/llm/agent.js]                 loop de até 6 rodadas
   │  "===TOOL==={json}===END==="  ← protocolo de function calling via texto
   ▼
[src/services/toolExecutor.js]     executa as ferramentas NO PRÓPRIO PROCESSO
   ├─ consultar_disponibilidade()  → availabilityService.js
   ├─ agendar_reuniao()            → schedulingService.js (+ notifica Igor por WhatsApp/email)
   ├─ salvar_resumo_cliente()      → clientMemoryService.js
   ├─ notificar_emergencia()       → emergencyService.js
   └─ enviar_imagem()              → imageService.js (se IMAGENS_ATIVO=true)
   ▼
[src/db/]  SQLite (better-sqlite3)  tabelas: clientes + agenda + servicos
   ▼
[opencode serve :4096]            o LLM em si (local e gratuito)
```

### Por que o protocolo de ferramentas é via texto?
O `opencode serve` expõe a session API (`POST /session/:id/message`), não um endpoint com `tools` nativos. Para o modelo chamar as funções de negócio, o system prompt instrui a resposta com um envelope JSON marcado (`===TOOL===` / `===END===`). O `agent.js` executa a ferramenta localmente e realimenta a mesma sessão com o resultado. Cada cliente tem **uma sessão** no opencode (a thread fica no servidor) e **um registro** na tabela `clientes` (resumo persistido).

---

## Pré-requisitos

- **Node.js ≥ 20** (testado com 24.x)
- **CLI do opencode** instalado e no PATH (`opencode --version`)

## Como rodar

**1. Instalar dependências:**

```bash
npm install
```

**2. Subir o opencode server (em um terminal):**

```bash
npm run serve
```

Recomendado proteger com senha:
```bash
OPENCODE_SERVER_PASSWORD=uma-senha npm run serve
# e defina o mesmo valor em OPENCODE_SERVER_PASSWORD no .env
```

**3. Copiar e preencher o `.env`:**

```bash
copy .env.example .env
```

**4. (Opcional) Testar a IA local antes de tudo:**

```bash
npm run test:llm
```

**5. Iniciar o bot e escanear o QR Code com o WhatsApp do Igor:**

```bash
npm start
```

O QR aparece no terminal. Depois da primeira conexão, a sessão fica salva em `.sessions` (não precisa escanear de novo).

> **Agendamento:** o bot gera e limpa os horários automaticamente no start e a cada 12h (ver `src/db/autoSeed.js`). Não é preciso rodar `npm run seed` manualmente, mas o script continua disponível.

---

## Banco de Dados

SQLite via `better-sqlite3` (zero infraestrutura), caminho padrão `./data/agent.db`. Schema em `src/db/schema.js`.

- **`clientes`** — telefone (pk), nome, resumo da última interação (memória de longo prazo), timestamps.
- **`agenda`** — slots de reunião com `status`: `livre` → `agendado` → `confirmada`/`cancelada`. Marca cliente e motivo quando agendado. Slots `livre` passados são limpos automaticamente.
- **`servicos`** — catálogo editável manualmente: `nome`, `descricao`, `preco`, `ativo`, `ordem`. É a fonte da verdade que o LLM usa para apresentar serviços.

---

## Configuração (`.env`)

Veja o `.env.example` completo. Principais variáveis:

| Variável | Padrão | Descrição |
|---|---|---|
| `LLM_BACKEND` | `local-opencode` | Backend da IA. |
| `OPENCODE_SERVER_URL` | `http://127.0.0.1:4096` | Onde o `opencode serve` está rodando. |
| `OPENCODE_MODEL` | default da máquina | Ex: `opencode/big-pickle`. |
| `WORK_SCHEDULE` | `1-4:12-21,5:10-19,6:8-14` | Horários de **trabalho/bloqueados**: `dias:inicio-fim`. |
| `SCHEDULE_START` / `SCHEDULE_END` | `7` / `24` | Janela do dia em que slots podem existir. |
| `SLOT_MINUTES` | `60` | Duração de cada slot (1h). |
| `HORIZON_DAYS` | `14` | Dias à frente do auto-seed. |
| `NOTIF_WHATSAPP` | vazio | Número do Igor p/ avisar agendamentos via WhatsApp. |
| `NOTIF_EMAIL` | vazio | Email do Igor p/ avisar agendamentos. |
| `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Gmail | SMTP (senha de app). |
| `EMERGENCY_NUMBER` | vazio | Número que recebe alertas de urgência. |
| `IMAGENS_ATIVO` | `false` | Habilita envio de imagens/GIFs ao cliente. |
| `WELCOME_IMAGE` / `WELCOME_TEXT` / `WELCOME_INACTIVE_HORAS` | `boasvindas_gif` / texto / `24` | Boas-vindas. |
| `KEEP_MESSAGES` / `SUMMARIZE_EVERY` | `12` / `5` | Histórico volátil e frequência do resumo persistente. |

---

## Imagens / GIFs

Quando `IMAGENS_ATIVO=true`, o bot pode enviar ao cliente imagens/GIFs catalogados em `assets/imagens/manifest.json`:

```json
{
  "logo_igor":          { "arquivo": "logo.png",               "descricao": "Logo do Igor Dev" },
  "catalogo_servicos":  { "arquivo": "catalogo-servicos.png",  "descricao": "Tabela de serviços e preços" },
  "boasvindas_gif":     { "arquivo": "boasvindas.gif",         "descricao": "GIF de boas-vindas" }
}
```

O LLM escolhe o apelido e o serviço localiza o arquivo (`.png`/`.jpg`/`.gif`) e envia via WhatsApp. O GIF é enviado como vídeo com `gifPlayback: true`.

---

## Comandos

| Comando | Ação |
|---|---|
| `npm run serve` | Sobe o opencode server (:4096) — outra janela |
| `npm start` | Inicia o bot do WhatsApp |
| `npm run dev` | Inicia com watch |
| `npm run seed` | Gera horários livres na agenda (manual, o bot já auto-seeda) |
| `npm run test:llm` | Smoke test da IA local |

---

## Aviso de privacidade

O modelo **`big-pickle` é gratuito**, mas durante o período free as interações podem ser usadas para melhorar o modelo. Para dados sensíveis de clientes em produção, prefira um modelo pago com zero-retention ou um modelo local de verdade (ex: Ollama).