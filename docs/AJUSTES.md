# Ajustes — serviços, agenda, boas-vindas, imagens

Guia prático para o Igor ajustar o bot sem precisar de código.

> Para explicações de como cada funcionalidade funciona por dentro, veja [FEATURES.md](FEATURES.md) — cada uma tem página dedicada.

## Personalizar a IA (persona)

Dá para mudar o **nome, o jeito de falar e o foco do bot** sem mexer em código: rode o painel (`npm run admin` ou `npm start`), abra `http://127.0.0.1:3000` e vá na aba **Persona**. Preencha, clique em **Salvar** — vale na hora, sem reiniciar o bot.

- O que muda: nome do assistente, identidade do negócio, como chamar o profissional, descrição do que oferece, personalidade/tom, mensagem de boas-vindas, usar emojis ou não, itens de "**sempre**" e "**nunca**".
- O que **não** muda (guardrails fixos): nunca informar preço, nunca se passar pelo profissional, anti-abuso, escopo e sigilo.
- Fica salvo em `data/persona.json` (fora do Git). O botão **Restaurar padrão** volta ao original.
- Use **Pré-visualizar prompt** para ver o texto final que a IA recebe (WhatsApp ou Chat web).

Detalhes completos: [persona.md](features/persona.md).

## Catálogo de serviços

A forma mais fácil é o **painel web** (CRUD): rode `npm run admin` e abra `http://127.0.0.1:3000`. Lá você pode criar, editar, ativar/desativar e excluir serviços pelo navegador — as mudanças valem imediatamente, sem reiniciar o bot. Detalhes técnicos: [painel-admin.md](features/painel-admin.md).

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
- **Dica:** os serviços podem ser gerenciados sem SQL pelo painel web (`npm run admin`) — inclui lista com toggle de ativo. Detalhes: [painel-admin.md](features/painel-admin.md).

## Agenda e horários de trabalho

Os horários **bloqueados** (quando o Igor trabalha e não agenda) ficam na variável `WORK_SCHEDULE` do `.env`:

```env
WORK_SCHEDULE=1-4:12-21,5:10-19,6:8-14
```

Formato: `dia-inicial-dia-final:hora-inicio-hora-fim`, separado por vírgula. Dias: `0`=Dom, `1`=Seg … `6`=Sáb.

Exemplo — trocar sábado para bloquear 8h–14h e domingo 9h–12h:

```env
WORK_SCHEDULE=1-4:12-21,5:10-19,6:8-14,0:9-12
```

Janela em que o cliente pode agendar: `SCHEDULE_START` (ex.: `7`) e `SCHEDULE_END` (ex.: `24`). Slots: `SLOT_MINUTES` (ex.: `60` para 1h).

> Após alterar o `.env`, **reinicie o bot** — ele re-seeda a agenda no start e a cada 12h.
> Slots `livre` passados são apagados automaticamente; agendamentos feitos não são perdidos.

Trocas de horário fechadas também aparecem no prompt do bot automaticamente (the catálogo de agenda é lido do `.env`).

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

- `NOTIF_WHATSAPP` — número do Igor (ex.: `5524998190280`) para aviso no WhatsApp.
- `NOTIF_EMAIL` — email do Igor.
- `SMTP_*` — credenciais Gmail (ver `docs/SMTP.md`).

Quando um cliente agenda, o bot envia o horário + cliente para os dois canais.