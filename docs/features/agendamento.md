> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 📅 Agendamento Inteligente

Deixa o cliente **agendar uma reunião com o Igor sozinho**, respeitando a rotina de trabalho dele. O bot conhece quando o Igor trabalha (horários **bloqueados**), quando pode atender, e exibe/se agende via conversa.

## Como funciona

1. **Auto-seed** (`src/db/autoSeed.js`): no start e a cada 12h, o bot gera slots `livre` na tabela `agenda` para os próximos dias, dentro da janela de atendimento e **fora** dos horários de trabalho. Slots livres já passados são limpos.
2. **Cliente pergunta horário** → a ferramenta `consultar_disponibilidade` (`availabilityService.js`) lê os slots livres.
3. **Cliente escolhe um horário** → a ferramenta `agendar_reuniao` (`schedulingService.js`) reserva o slot (status `livre` → `agendado`), grava cliente/motivo e **notifica o Igor** (ver [notificações](notificacoes.md)).

## Regras de horário (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `WORK_SCHEDULE` | `1-4:12-21,5:10-19,6:8-14` | Horários de **trabalho/bloqueados**: `dias:inicio-fim` (0=Dom..6=Sáb, ranges ok) |
| `SCHEDULE_START` | `7` | Começa quando o dia pode ter slots (ex.: 07h) |
| `SCHEDULE_END` | `24` | Fim da janela de slots |
| `SLOT_MINUTES` | `60` | Duração de cada slot (1h) |
| `HORIZON_DAYS` | `14` | Quantos dias à frente o auto-seed gera |

Exemplo atual: o Igor trabalha seg–qui 12h–21h, sex 10h–19h, sáb 8h–14h e dom fica livre. A janela de agendamento é 7h–0h, então o cliente encontra horários **fora** desses blocos.

> Mudou no `.env`? Reinicie o bot — ele re-seeda a agenda.

## O que o LLM faz e não faz

- Oferece **no máximo 3 horários por mensagem** e só agenda após **confirmação explícita** do cliente.
- Responde com elegância quando não há horários (`agenda_cheia`): avisa que vai deixar o contato sinalizado.
- Agenda os estados na tabela:

| Estado | Significado |
|---|---|
| `livre` | Slot disponível (gerado/limpo automaticamente) |
| `agendado` | Reservado pelo cliente (aguardando a reunião) |
| `confirmada` / `cancelada` | Próximos passos (São manuais/previstos para o Igor confirmar) |

## Arquivos

- `src/db/autoSeed.js` — `gerarSlots()` + `limparSlotsPassados()` (start + a cada 12h)
- `src/services/availabilityService.js` — `consultar_disponibilidade`
- `src/services/schedulingService.js` — `agendar_reuniao`
- `src/config.js` → `config.agenda` — parse de `WORK_SCHEDULE` etc.
- Tabela `agenda` em `src/db/schema.js`

## 🔮 Futuro: reagendamento da reunião

Hoje, depois de agendar, **mudar o horário é manual** (o Igor remarca pelos próximos passos `confirmada`/`cancelada`). Uma evolução natural é deixar o **próprio cliente remarcar** pela conversa:

- **Cancelar/remarcar** a própria reunião por WhatsApp (novo fluxo + ferramenta `reagendar_reuniao`), devolvendo o slot para `livre` e reutilizando, se quiser, o slot padrão de replanejamento (o mesmo do problema em `agenda_cheia`, que já existe no `agendamento.md`).
- **Validações:** só permite remarcar dentro de uma janela (ex.: até N horas antes), não conflitar com a nova disponibilidade e confirmar explicitamente antes de trocar.
- **Notificação** ao Igor quando o cliente remarca (email/WhatsApp), igual ao agendamento.
- **Versionar o histórico:** manter o slot original como `agendado` marcado como "remarcado" (coluna `reativo`/`history`) para rastreio — exige mudança no schema.

> Item de **roadmap**: nada disso existe ainda. É um passo natural para o Igor tocar depois de validar o fluxo de agendamento no dia a dia.