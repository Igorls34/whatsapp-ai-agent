> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🧠 Memória de Longo Prazo

O bot lembra de cada cliente **entre conversas**: o ChatGPT esqueceria tudo se a thread acabasse, mas aqui cada cliente tem um resumo persistido em SQLite que é injetado no contexto sempre que ele volta a falar.

## Dois níveis de memória

| Nível | Onde fica | Vida útil | Conteúdo |
|---|---|---|---|
| **Volátil** | `conversationMemory.js` (em RAM) | Durante a conversa + até `KEEP_MESSAGES` (12) mensagens | Histórico recente da sessão |
| **Persistente** | tabela `clientes` (SQLite) | Indefinida (entre conversas) | Resumo consolidado do cliente |

## Como funciona

1. **No start da conversa**, `messageHandler.js` busca o resumo do cliente na tabela `clientes` e injeta na seção `# Contexto persistente do cliente` do system prompt. Por isso o bot reconhece o cliente na volta: "Olá novamente! 😊 O que foi que combinamos da última vez…".
2. **Durante a conversa**, tudo fica na memória volátil por cliente.
3. **Resumo periódico** (`src/llm/summarizer.js`): a cada `SUMMARIZE_EVERY` (5) mensagens, o bot gera um novo resumo — fundindo o resumo anterior + conversa recente — e grava na tabela com `salvar_resumo_cliente`/`repos.atualizarResumo`.
4. **Ferramenta `salvar_resumo_cliente`**: o próprio LLM pode pedir para gravar um resumo em momentos relevantes (ex.: serviço de interesse, orçamento solicitado, decisão tomada).

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `KEEP_MESSAGES` | `12` | Quantas mensagens recentes guardar em memória por cliente |
| `SUMMARIZE_EVERY` | `5` | A cada quantas mensagens regrava o resumo persistente |

## Edge cases

- **Banco offline** (`banco_indisponivel`): o atendimento segue sem contexto, com resposta genérica para não parecer "amnésia".
- Cliente **novo** (sem registro): cria o registro e manda boas-vindas (ver [agente-ia](agente-ia.md)).
- O resumo é **texto livre consolidado** — mantém o essencial (contexto do projeto, assunto tratado, decisões), não o texto cru.

## Arquivos

- `src/memory/conversationMemory.js` — memória volátil (histórico + contador de resumo)
- `src/llm/summarizer.js` — gera o resumo consolidado
- `src/services/clientMemoryService.js` — ferramenta `salvar_resumo_cliente`
- `src/db/repositories.js` → `clientes` (get/upsert/atualizarResumo/tocarInteracao)
- Tabela `clientes` em `src/db/schema.js`