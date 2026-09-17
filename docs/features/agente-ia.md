> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🎯 Agente de IA no WhatsApp (núcleo)

O **principal** do projeto: um assistente virtual 24/7 que atende clientes do Igor pelo WhatsApp usando um LLM rodando **localmente** via `opencode serve` — sem depender de APIs pagas para começar.

## Visão geral

```
Cliente (WhatsApp)
   → messageHandler.js      (orquestra cada mensagem)
   → agent.js               (loop de raciocínio)
   → opencode serve :4096   (o LLM: gera as respostas)
   → toolExecutor.js        (executa funções de negócio quando o LLM pedir)
   → SQLite                 (memória, agenda, catálogo)
```

## Como o agente pensa

1. **O cliente envia uma mensagem** → `messageHandler.js` resolve o número do cliente, trata mídia/boas-vindas e busca o resumo persistido dele.
2. **O contexto é montado** com `systemPrompt.js` (persona + regras) + resumo do cliente + catálogo de serviços + imagens disponíveis. Cada cliente tem **uma sessão** no opencode (a thread fica no servidor) — por isso o bot "lembra" do papo durante a conversa.
3. **O LLM responde** — pode ser texto puro ou um **pedido de ferramenta**.
4. **Loop de até 6 rodadas**: sempre que o LLM pede uma ferramenta, o `agent.js` a executa localmente e realimenta a sessão com o resultado, até o modelo dar a resposta final.
5. **A resposta é enviada** no WhatsApp — podendo ser dividida em até 3 mensagens (separador `|||`, 1,5s de intervalo) para parecer natural.

## Protocolo de ferramentas em texto

O `opencode serve` expõe a session API (`POST /session/:id/message`), **sem** suporte nativo a `tools`. A solução:

- O `systemPrompt.js` instrui o modelo a responder com um envelope JSON marcado quando precisar de uma ferramenta:

```
===TOOL===
{"nome":"agendar_reuniao","argumentos":{...}}
===END===
```

- `toolProtocol.js` (de)serializa esse envelope; `agent.js` executa a função no próprio processo e devolve o resultado para a mesma sessão do modelo.
- As ferramentas disponíveis estão em `src/llm/tools.js` (descrições que o LLM enxerga):

| Ferramenta | Serviço | Descrição |
|---|---|---|
| `consultar_disponibilidade` | `availabilityService.js` | Horários livres da agenda |
| `agendar_reuniao` | `schedulingService.js` | Reserva um horário (ver [agendamento](agendamento.md)) |
| `salvar_resumo_cliente` | `clientMemoryService.js` | Grava memória do cliente (ver [memória](memoria.md)) |
| `notificar_emergencia` | `emergencyService.js` | Avisa o Igor de urgência (ver [notificações](notificacoes.md)) |
| `enviar_imagem` | `imageService.js` | Envia imagem/GIF (ver [imagens](imagens.md)) |

## Guardrails e persona

O `systemPrompt.js` define regras rígidas:

- **VALORES NUNCA:** o bot **jamais** informa preços/orçamentos ao cliente — valores são passados pessoalmente pelo Igor. Quando perguntado, sugere marcar uma reunião.
- **Catálogo como fonte da verdade:** só apresenta serviços cadastrados na tabela `servicos` (nome + descrição), nunca inventa. O catálogo é montado **agrupado por `categoria`** (ex: Design Gráfico, Engenharia), o que deixa a apresentação do bot mais organizada.
- **Sem promessas:** não promete prazos/garantias; remete ao Igor o que não estiver descrito.
- **Escopo comercial:** redireciona assuntos fora do foco.
- **Só 3 opções de horário por mensagem**, agendamento só após confirmação explícita.

## Mensagens múltiplas e boas-vindas

- **`|||`** divide a resposta em até 3 mensagens separadas (uma por tópico), com atraso de 1,5s entre elas.
- **Boas-vindas** para cliente novo ou inativo há +24h (`WELCOME_INACTIVE_HORAS`): texto, e opcionalmente GIF com a apresentação (`IMAGENS_ATIVO=true`, ver [imagens](imagens.md)).

## Backend da IA (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `LLM_BACKEND` | `local-opencode` | `local-opencode` (opencode local) ou `openai-compatible` (futuro) |
| `OPENCODE_SERVER_URL` | `http://127.0.0.1:4096` | Endereço do `opencode serve` |
| `OPENCODE_MODEL` | default da máquina | Ex.: `opencode/big-pickle` |
| `OPENCODE_SERVER_PASSWORD` | vazio | Senha do servidor (mesmo valor no server e no bot) |

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/llm/agent.js` | Loop de raciocínio + monta catálogo no context |
| `src/llm/toolProtocol.js` | Envelope `===TOOL===/===END===` |
| `src/llm/tools.js` | Definições das ferramentas |
| `src/llm/localOpencodeAdapter.js` | Cliente HTTP do `opencode serve` |
| `src/prompt/systemPrompt.js` | Persona + regras + guardrails |
| `src/whatsapp/messageHandler.js` | Orquestração da mensagem (contexto → agente → resposta) |
| `src/services/toolExecutor.js` | Ponte ferramenta → serviço real |

## Pontos de atenção

- Se o `opencode serve` cair, o bot continua no WhatsApp, mas responde "não consegui responder 😅" — é só religar o servidor.
- O transporte do WhatsApp (Baileys) não é o padrão de mercado (Evolution API) — ver nota no [README](../../README.md).