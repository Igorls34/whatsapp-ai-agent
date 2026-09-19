# 🎨 Persona personalizável

Deixa o responsável **personalizar a IA sem mexer em código** — o nome, o jeito de falar, o que o negócio oferece e preferências do tipo "sempre" / "nunca". Tudo por uma página no painel admin.

> A **persona** (identidade, tom e preferências) é editável. Os **guardrails** (nunca informar preço, nunca se passar pelo responsável, anti-abuso, escopo, sigilo) são **fixos** e ficam concatenados por cima — assim a personalização nunca quebra a segurança do bot.

## Como editar (painel)

1. Rode `npm run admin` (ou use o `npm start`, que já sobe o painel) e abra `http://127.0.0.1:3000`.
2. Abra a aba **Persona**.
3. Preencha os campos e clique em **Salvar persona**.

As mudanças valem **imediatamente**: o prompt é montado a cada mensagem, então não precisa reiniciar o bot.

### Campos da página

| Campo | Para quê | Exemplo |
|---|---|---|
| **Nome do assistente** | Como o bot se apresenta | `Assistente Virtual` |
| **Nome / identidade do negócio** | Identidade que aparece no atendimento | `Maria Souza (Studio MS)` |
| **Como chamar o profissional** | Referência ao responsável nas mensagens | `a Maria`, `a equipe` |
| **O que o negócio oferece** | Descrição apresentada ao cliente | `cortes e barba, agendamento online` |
| **Personalidade e jeito de falar** | Tom de voz e postura | `Descontraída e próxima, sem gírias pesadas` |
| **Mensagem de boas-vindas** | Texto enviado quando o cliente chega (opcional) | `Olá! 👋 Como posso ajudar?` |
| **Usar emojis** | Liga/desliga emojis nas mensagens | ligado |
| **Sempre fazer** | Itens (um por linha) que a IA deve sempre seguir | `confirmar o horário antes de agendar` |
| **Nunca fazer** | Itens (um por linha) que a IA deve evitar | `falar de política` |
| **Observações livres** | Orientação extra (avançado, opcional) | `Sempre tratar o cliente pelo primeiro nome` |

### Pré-visualizar o prompt

O botão **Pré-visualizar prompt** mostra exatamente o texto final que a IA recebe (separado por **WhatsApp** e **Chat web**). Útil para conferir antes de salvar — a prévia **não** salva nada.

## Onde fica salvo

| Arquivo | Papel | Versionado? |
|---|---|---|
| `src/prompt/persona.default.json` | **Padrões de fábrica** (ponto de partida) | Sim |
| `data/persona.json` | **Sua personalização** (o que a página salva) | Não (fica no `data/`, fora do Git) |

A persona efetiva = padrões **+** personalização. O botão **Restaurar padrão** apaga `data/persona.json` e volta aos defaults.

> Como `data/` é ignorado pelo Git, a personalização sobrevive a atualizações do projeto e nunca vai para o repositório.

## Editar direto no JSON (avançado)

Quem preferir pode editar `data/persona.json` num editor de texto. O formato é simples:

```json
{
  "assistente": "Assistente Virtual",
  "negocio": "Studio MS",
  "responsavel": "a Maria",
  "descricao": "cortes e barba, agendamento online",
  "tom": "Descontraída e próxima, fala de forma simples.",
  "emojis": true,
  "saudacao": "Olá! 👋 Como posso ajudar?",
  "sempre": "confirmar o horário antes de agendar",
  "nunca": "falar de política",
  "extra": ""
}
```

Os campos de texto `sempre` e `nunca` aceitam várias linhas (uma orientação por linha). A `saudacao` vale **na hora** (sem reiniciar); se ficar vazia, o bot usa a mensagem de boas-vindas definida no `.env` (`WELCOME_TEXT`).

### Caminho customizado

Por padrão o arquivo fica em `data/persona.json`. Para apontar para outro lugar, defina `PERSONA_PATH` no `.env`:

```env
PERSONA_PATH=./minha-persona.json
```

## Arquivos envolvidos

| Arquivo | Papel |
|---|---|
| `src/prompt/persona.js` | Leitura, gravação, mesclagem e reset da persona |
| `src/prompt/persona.default.json` | Defaults versionados |
| `src/prompt/systemPrompt.js` | Monta o prompt usando a persona + guardrails fixos |
| `src/llm/agent.js` | Monta o prompt a cada turno (persona vale na hora) |
| `src/admin/server.js` | Rotas `GET/PUT /api/persona`, `POST /api/persona/reset` e `/api/persona/preview` |
| `src/admin/index.html` | Aba **Persona** (formulário + pré-visualização) |
