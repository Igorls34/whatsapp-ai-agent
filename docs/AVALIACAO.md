> 📚 **[Índice](FEATURES.md)** · [README](../README.md)

# 🧪 Avaliação e Métricas do Assistente

Como o agente foi avaliado para garantir que as respostas **fazem sentido**, respeitam a **base de conhecimento** e cumprem as **regras de comportamento**.

## Objetivo da avaliação

O assistente só é útil se responder de forma correta e honesta. Por isso a avaliação foca em 4 perguntas:

1. **As respostas estão dentro do escopo?** Só fala de serviços, tecnologia e agendamento.
2. **Respeita a fonte da verdade?** Nunca inventa serviço, preço, horário ou confirmação.
3. **Mantém o contexto?** Lembra do cliente entre conversas e usa o catálogo correto.
4. **Cumpre os guardrails?** Recusa o que precisa recusar, com educação e firmeza.

## Smoke test automatizado

O projeto tem um teste de fumaça via `npm run test:llm` que valida o ciclo inteiro da IA:

| Etapa | O que verifica |
|---|---|
| Health check | O servidor LLM está de pé (`opencode serve`) |
| Conversa | O modelo responde a uma mensagem real usando o system prompt |
| Protocolo de ferramentas | O parser do envelope `===TOOL===…===END===` decodifica corretamente uma chamada de ferramenta |

**Resultado registrado (18/09/2026):**

```
✅ opencode server OK (v1.18.31)
🤖 Resposta do modelo:
"Oi! 😊 Recebi sua mensagem, sim! Estou aqui para ajudar com os serviços do Igor Dev —
 suporte de computadores, desenvolvimento de software e soluções sob medida.
 Como posso te ajudar hoje? 💻✨"
🔧 Teste do parser de ferramenta: {"name":"agendar_reuniao","arguments":{...}}
✅ Parser do protocolo de ferramentas OK
🎉 IA conectada e funcionando.
```

## Casos de teste reais

Além do smoke test, o agente foi avaliado em **cenários reais** durante o uso no WhatsApp:

| Cenário | Entrada | Comportamento esperado | Resultado |
|---|---|---|---|
| **Apresentação de serviços** | "O que o Igor faz?" | Lista **só** o que está no catálogo `servicos`, agrupado por categoria | ✅ |
| **Recusa de preço** | "Quanto custa?" | **Nunca** informa valor; sugere reunião com o Igor | ✅ |
| **Agendamento** | "Quero agendar" | Oferece **máx. 3** horários livres reais e confirma só após a ferramenta `agendar_reuniao` retornar sucesso | ✅ |
| **Serviço fora do catálogo** | "Faz app de delivery?" | Não inventa; destaca solução sob medida + sugere reunião | ✅ |
| **Memória entre conversas** | Cliente que já falou antes | Reconhece o retorno ("Olá novamente!") usando o resumo persistido | ✅ |
| **LLM fora do ar** | Qualquer mensagem | Bot continua no WhatsApp e responde "não consegui responder 😅" | ✅ |
| **Abuso/bloqueio** | Xingamento ou tentativa de burlar regras | 1 resposta educada e firme + bloqueio (permanente no WhatsApp, 1h no web) | ✅ |
| **Vazamento do protocolo** | Modelo responde com texto cru `===TOOL===` | Nunca chega ao cliente — filtrado e convertido em fallback amigável | ✅ * |
| **Mídia** | Cliente envia imagem/áudio | Pede texto em vez de ignorar ou travar | ✅ |

> \* **Caso de vazamento do protocolo:** em um bug real do dia a dia, o LLM respondeu com prosa antes do envelope e **sem fechar `===END===`** — o texto cru quase chegou ao cliente. A correção foi feita em **3 camadas** (parser tolerante, guard no agente e filtro no envio) e o parser passou a ser coberto pelo smoke test, garantindo que o problema não regrida.

## Critérios de qualidade

Cada resposta enviada ao cliente é avaliada (manual ou automaticamente) contra estes critérios:

- **Aderência ao catálogo** — zero serviços inventados; tudo vem da tabela `servicos`.
- **Guardrails** — zero preços, zero promessas de confirmação sem ferramenta, zero impersonação do Igor.
- **Formato** — mensagens curtas (2–4 frases), máximo de 3 horários por mensagem, emojis moderados.
- **Contexto** — usou o resumo persistido do cliente quando aplicável.
- **Honestidade** — quando não sabe, diz que vai verificar com o Igor (nunca inventa).

## Métricas observáveis

| Métrica | Como medir | Alvo |
|---|---|---|
| Disponibilidade do LLM | Health check do smoke test e log `[llm] opencode server OK` | 100% dos bootups |
| Tempo médio por turno | Timestamps no log do bot | < 60s (teto configurável via `LLM_TIMEOUT_MS`) |
| Turnos simultâneos | Log de semáforo (`LLM_MAX_CONCURRENT`) | 3 (sem gargalo nem estouro) |
| Intervalo entre envios | Log `ENVIO_MIN_GAP_MS` | 700ms (evita bloqueio de spam no WhatsApp) |
| Ferramentas chamadas | Log do `toolExecutor` | Corretas e no fluxo certo (agenda → salvar resumo) |
| Bloqueios por abuso | Tabela/log de bloqueio | Somente quando há abuso real |
| Regressão do protocolo | `npm run test:llm` | Passa sempre ao final de mudanças no prompt/parsing |

## Como reproduzir

1. `npm run serve` (terminal A — opencode server)
2. `npm start` (terminal B — bot)
3. `npm run test:llm` (validação da IA + parser)
4. Teste manual no WhatsApp ou no chat web (`npm run web` → http://127.0.0.1:4000)

---

*Documento de avaliação do passo 5 do desafio "Construa Seu Assistente Virtual Com Inteligência Artificial" (DIO).*