# Ajustes — serviços, agenda, boas-vindas, imagens

Guia prático para o Igor ajustar o bot sem precisar de código.

> Para explicações de como cada funcionalidade funciona por dentro, veja [FEATURES.md](FEATURES.md) — cada uma tem página dedicada.

## Personalizar a IA (persona)

Dá para mudar o **nome, o jeito de falar e o foco do bot** sem mexer em código: rode o app (`npm start`) e abra `http://127.0.0.1:4000/admin`, na aba **Persona**. Preencha, clique em **Salvar** — vale na hora, sem reiniciar o bot.

- O que muda: nome do assistente, identidade do negócio, como chamar o profissional, descrição do que oferece, personalidade/tom, mensagem de boas-vindas, usar emojis ou não, itens de "**sempre**" e "**nunca**".
- O que **não** muda (guardrails fixos): nunca informar preço, nunca se passar pelo profissional, anti-abuso, escopo e sigilo.
- Fica salvo em `data/persona.json` (fora do Git). O botão **Restaurar padrão** volta ao original.
- Use **Pré-visualizar prompt** para ver o texto final que a IA recebe (WhatsApp ou Chat web).

Detalhes completos: [persona.md](features/persona.md).

## Catálogo de serviços

A forma mais fácil é o **painel web** (CRUD): rode `npm start` e abra `http://127.0.0.1:4000/admin`. Lá você pode criar, editar, ativar/desativar e excluir serviços pelo navegador — as mudanças valem imediatamente, sem reiniciar o bot. Detalhes técnicos: [painel-admin.md](features/painel-admin.md).

Alternativamente, direto no banco:

Os serviços ficam na tabela `servicos` do SQLite (`data/agent.db`). Campos: `nome`, `descricao`, `categoria`, `preco`, `ativo`, `ordem`.

É a **única fonte da verdade** do LLM: ele só apresenta o que estiver cadastrado e `ativo = 1`.

Para incluir/editar via linha de comando:

```powershell
# ex.: listar
node -e "const db=require('better-sqlite3')('data/agent.db'); console.log(db.prepare('SELECT * FROM servicos').all())"
```

Ou, de forma mais amigável, use uma ferramenta de SQLite (ex.: [DB Browser for SQLite](https://sqlitebrowser.org/)) abrindo `data/agent.db` e editando a tabela `servicos`.

Regras:
- **Valores nunca são falados pelo bot** — por regra de negócio, o bot não informa preços de nenhum serviço. Se o cliente perguntar quanto custa, o bot remete ao Igor e sugere agendar uma reunião para ele passar o orçamento. Mesmo que a coluna `preco` esteja preenchida (referência interna do Igor), o bot não a lê nem a repassa.
- `ativo = 0` esconde o serviço sem apagar (útil em promoções/lançamentos).
- `ordem` controla a exibição (menor primeiro).
- **Dica:** os serviços podem ser gerenciados sem SQL pelo painel web (`npm start` → `/admin`) — inclui lista com toggle de ativo. Detalhes: [painel-admin.md](features/painel-admin.md).

## Agenda e horários de trabalho

**Mais fácil (recomendado):** aba **⚙️ Configurações** do painel (`npm start` → `/admin`). Lá você edita o expediente e a janela de agendamento **sem mexer em código e sem reiniciar** — a agenda é re-seedada na hora.

Os campos são:
- **Expediente** (`WORK_SCHEDULE`) — horários **bloqueados** (quando o Igor trabalha e não agenda). Formato `dias:inicio-fim` separado por vírgula (dias: `0`=Dom … `6`=Sáb). Ex.: `1-4:12-21,5:10-19,6:8-14`.
- **Início/fim do dia** (`SCHEDULE_START`/`SCHEDULE_END`) — janela em que o cliente pode agendar.
- **Slot** (`SLOT_MINUTES`) — duração de cada horário (ex.: `60` para 1h).
- **Dias à frente** (`HORIZON_DAYS`) — até quando o auto-seed gera horários livres.

> O painel grava em `data/settings.json`. Se o campo ficar **vazio**, vale o valor do `.env` — então dá para continuar usando o `.env` se preferir (mas aí precisa reiniciar o bot).

## Boas-vindas

- `WELCOME_TEXT` — texto de apresentação usado quando o cliente é novo ou inativo há +24h.
- `WELCOME_INACTIVE_HORAS` — após quantas horas sem interação o cliente recebe boas-vindas de novo.
- `IMAGENS_ATIVO` — `true` para o bot enviar GIF/imagem de boas-vindas; `false` envia só texto.

## Imagens/GIFs enviáveis

1. Coloque o arquivo em `assets/imagens/` (ex.: `assets/imagens/logo.png`).
2. Cadastre no `assets/imagens/manifest.json`:

```json
{
  "logo_igor": { "arquivo": "logo.png", "descricao": "Logo do Igor Dev" }
}
```

3. Garanta `IMAGENS_ATIVO=true` no `.env` e reinicie o bot.

O LLM verá a seção "Imagens disponíveis" no contexto e poderá acionar a ferramenta `enviar_imagem` com o apelido (chave do JSON).

## Notificações de agendamento

**Mais fácil (recomendado):** aba **⚙️ Configurações** do painel — preencha o **WhatsApp do Igor** e o **Email do Igor**, clique em salvar, vale na hora (sem reiniciar).

- `NOTIF_WHATSAPP` — número do Igor (ex.: `5524998190280`) para aviso no WhatsApp.
- `NOTIF_EMAIL` — email do Igor.
- `SMTP_*` — credenciais Gmail (ver `docs/SMTP.md`; continuam no `.env`).

Quando um cliente agenda, o bot envia o horário + cliente para os dois canais.