> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🔔 Notificações

O bot **avisa o Igor** automaticamente em dois momentos: quando um cliente agenda (WhatsApp + email) e quando um cliente precisa de atendimento urgente.

## 1. Notificação de agendamento

Quando `agendar_reuniao` reserva um horário, o `notificationService.js` dispara:

- **WhatsApp** para `NOTIF_WHATSAPP` (número do Igor)
- **Email** para `NOTIF_EMAIL` via SMTP (Gmail por padrão)

Conteúdo: cliente, horário e motivo.

Verificação no log:
```
[notif] agendamento 2026-09-18T14:00: WhatsApp=true | Email=true
```

### Configuração (`.env`)

| Variável | Descrição |
|---|---|
| `NOTIF_WHATSAPP` | Número do Igor (ex.: `5524998190280`) — vazio desativa WhatsApp |
| `NOTIF_EMAIL` | Email do Igor — vazio desativa email |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `smtp.gmail.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | Email + **senha de app** do Gmail (ver [SMTP.md](../SMTP.md)) |

> A senha de app é um passo manual do Gmail — o passo a passo completo está em [docs/SMTP.md](../SMTP.md).

## 2. Emergência (`notificar_emergencia`)

Quando o cliente está irritado, com urgência ou pedindo explicitamente falar com um humano, o LLM aciona `emergencyService.js`:

- Se `EMERGENCY_NUMBER` estiver preenchido → envia via WhatsApp para esse número (ou enfileira na outbox se o WhatsApp estiver desconectado);
- Senão → registra no log com prefixo `[EMERGENCIA]`.

## 3. Caixa de saída (outbox) — `avisos_pendentes`

Toda notificação de WhatsApp passa pela **outbox** (`src/notifications/outbox.js`), que decide entrega imediata ou persistência:

- **WhatsApp conectado** → envia na hora (respeitando o intervalo mínimo entre envios).
- **Sem socket ou falha de envio** → grava em `avisos_pendentes` **com o destinatário** (`destino`) e tenta de novo depois.
- **Sem socket novo** (pareamento/reconexão) → o app dispara a drenagem **no evento de conexão**; **não há mais polling a cada 30s**.
- Falhas com socket ativo usam **retry exponencial** (5s → … → 5min) e, após **5 tentativas**, o aviso é descartado com log.
- A tabela continua existindo para o aviso **sobreviver a um restart**: no boot, ele sai assim que o WhatsApp conectar.

No painel, `avisosPendentes` no dashboard e `notificacoes.pendentes` no `/health` mostram o tamanho da fila.

## Arquivos

- `src/notifications/outbox.js` — entrega imediata + fila persistente + retry
- `src/services/notificationService.js` — WhatsApp (via outbox) + email (nodemailer)
- `src/services/emergencyService.js` — `notificar_emergencia`
- `src/services/toolExecutor.js` — deflagra `notificarAgendamento` pós-agendamento
- `src/core/brain.js` — cria a outbox única e avisa ouvintes quando o socket conecta
- `src/app.js` — drena a fila no evento de conexão (`brain.onSocket`)
- Config em `src/config.js` → `config.notificacoes`

## Pontos de atenção

- O app usa a **mesma conexão WhatsApp** para enviar as notificações ao Igor. Se o socket cair, o aviso fica na outbox (persistido) e o email segue normalmente.
- Como a outbox é única do processo, não existe mais diferença entre "notificação do bot" e "notificação do chat web" — as duas seguem o mesmo caminho.
- Para testar o email sem agendar: ver "Como testar rápido" em [SMTP.md](../SMTP.md).