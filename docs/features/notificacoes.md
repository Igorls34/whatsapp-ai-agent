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

- Se `EMERGENCY_NUMBER` estiver preenchido → envia via WhatsApp para esse número;
- Senão → registra no log com prefixo `[EMERGENCIA]`.

## Arquivos

- `src/services/notificationService.js` — WhatsApp + email (nodemailer)
- `src/services/emergencyService.js` — `notificar_emergencia`
- `src/services/toolExecutor.js` — deflagra `notificarAgendamento` pós-agendamento
- Config em `src/config.js` → `config.notificacoes`

## Pontos de atenção

- O bot usa a **mesma conexão WhatsApp** para enviar as notificações ao Igor — se o socket cair, só o email segue (e vice-versa o log em emergência).
- Para testar o email sem agendar: ver "Como testar rápido" em [SMTP.md](../SMTP.md).