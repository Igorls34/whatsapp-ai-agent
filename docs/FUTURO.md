> 📚 **[Índice](FEATURES.md)** · [README](../README.md)

# 🗺️ Futuro (roadmap)

Melhorias planejadas para deixar o bot mais independente e fácil de ajustar — **sem mexer em código**. Nenhuma destas existe ainda; é o plano "próximos passos" para quem for evoluir o projeto.

> Regra de ouro: as melhorias abaixo são sempre sobre **configuração via painel / `.env`**, mantendo **guardrails fixos** (nunca informar preço, nunca se passar pelo responsável, etc.).

## 🔧 Campo para inserir/editar o site do negócio

Hoje o bot **não conhece o site** do negócio. Quando o cliente pergunta "tem site?", a IA recorre à persona (`descricao`) e às boas respostas do `.env` — mas sem um endereço, ela não passa o link.

**Roadmap:**
- Novo campo **"Site do negócio"** na aba **Persona** do painel (`data/persona.json` → `site`).
- O prompt passa a incluir o endereço quando o cliente pergunta, e a IA **nunca inventa** um site (sem valor preenchido, ela remete ao responsável, como já faz com preços).
- Como `data/` é ignorado pelo Git, funciona no `master` e no `public` sem conflito — mesma regra da persona.

## 🔢 Campo para inserir/editar número e email de notificação

Hoje o número e o email de notificação (agendamento/emergência) são definidos só por env no `.env` (`NOTIF_WHATSAPP` / `NOTIF_EMAIL`) — mudar exige editar o arquivo e reiniciar.

**Roadmap:**
- Novo campo **"Contatos de notificação"** na aba **Notificações** do painel: número do WhatsApp e email de destino.
- Salvaria em `data/` (com fallback para as variáveis do `.env` quando vazio), valendo **na hora**, sem reiniciar — igual ao comportamento da persona (`salvarPersona` vale no próximo turno).
- Continuaria passando pelo `notificationService` atual (`notificar_agendamento` / `notificar_emergencia`), que já lida com WhatsApp + email.

## 🕒 Melhor organização dos horários de funcionamento

O bot **já respeita** o expediente (`WORK_SCHEDULE`) para gerar slots de agendamento. O roadmap é deixar a distribuição mais flexível e acertiva para o dia a dia:

- **Pausa para almoço / folga interna:** hoje um horário "livre" pode cair no intervalo do responsável. Planejado: descontar pausas da janela (ex.: `WORK_BREAK=12:00-13:00`), sem slot nessas faixas.
- **Tratar feriados/temporada:** uma tabela `feriados` (mesmo conceito de `data/persona.json`) para o Igor marcar dias fechados — o auto-seed não gera slots neles.
- **Tolerância entre slots:** reduzir colisões de agenda (ex.: deixar 15 min de folga entre reuniões) para a reunião anterior nunca "atrasar" a seguinte.

> Estas entram na arquitetura de **agendamento** ([features/agendamento.md](features/agendamento.md)) e reutilizam o `availabilityService` — incluindo a sinalização de "agenda cheia" já existente.

## 📦 Feito e pendente

| Item | Estado |
|---|---|
| Persona personalizável (identidade, tom, guardrails 🔒) | ✅ disponível — [features/persona.md](features/persona.md) |
| Agendamento inteligente (auto-seed + confirmação) | ✅ disponível — [features/agendamento.md](features/agendamento.md) |
| Site do negócio (campo) | 🔜 roadmap |
| Contatos de notificação (campo) | 🔜 roadmap |
| Organização dos horários (pausas, feriados, folga) | 🔜 roadmap |
| Reagendamento pelo cliente | 🔜 roadmap — [features/agendamento.md](features/agendamento.md) |
