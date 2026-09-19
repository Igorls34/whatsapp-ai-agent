<div align="center">

# 🤖 WhatsApp AI Agent — Igor Dev

**Assistente virtual 24/7 para WhatsApp** — um **agente de IA** que atende os clientes do Igor, apresenta os serviços dele, agenda reuniões respeitando os horários de trabalho e lembra de cada cliente entre conversas. O "cérebro" é o **próprio opencode rodando localmente** (`opencode serve`) — sem API keys para começar.

[![Node.js ≥ 20](https://img.shields.io/badge/Node.js-%E2%89%A5%2020-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![JavaScript ESM](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](#)
[![WhatsApp · Baileys](https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](#)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](#)
[![IA local · opencode](https://img.shields.io/badge/IA_local-opencode_serve-000000?style=for-the-badge)](#)

> **📚 Documentação técnica** vive na pasta `docs/` — veja o índice em [docs/FEATURES.md](docs/FEATURES.md) e a referência em [docs/REFERENCIA.md](docs/REFERENCIA.md).

</div>

## ⚡ Início rápido — 1 comando

Requisitos: [Node.js ≥ 20](https://nodejs.org). A CLI do **opencode** é opcional — o `npm run setup` instala se estiver faltando.

| Passo | Comando | O que faz |
|---|---|---|
| 1 | `npm install` | Instala as dependências do projeto |
| 2 | `npm run setup` | Wizard: identidade, agenda, notificações (instala o opencode se faltar) |
| 3 | `npm start` | **Sobe tudo:** IA + bot WhatsApp + painel admin + chat web, com auto-restart |

Na **primeira vez**, um QR Code aparece no terminal: escaneie com o WhatsApp do Igor (WhatsApp → Ajustes → Aparelhos conectados → Conectar aparelho). A sessão fica salva em `.sessions` — **não precisa escanear de novo**.

> [!NOTE]
> O `npm start` é um **supervisor**: se qualquer processo cair, ele religa sozinho (com backoff). Encerre com `Ctrl+C`.

## 🌐 O que abre em cada porta

| Componente | Endereço | O que é |
|---|---|---|
| 🤖 Painel admin | http://127.0.0.1:3000 | **Dashboard + gestão**: serviços, agenda e clientes |
| 💬 Chat web | http://127.0.0.1:4000 | Conversa com o mesmo agente no navegador (portfólio) |
| 🧠 IA local (opencode) | http://127.0.0.1:4096 | O modelo que gera as respostas (interno) |
| 📱 Bot WhatsApp | — | Atende por mensagem no celular (sessão em `.sessions`) |

> Alterações no painel admin valem **imediatamente**, sem reiniciar o bot.

## ✅ Como saber se está de pé

| Log do terminal | Significado |
|---|---|
| `[whatsapp] Conectado e pronto para atender 24/7.` | WhatsApp conectado 🟢 |
| `[llm] opencode server OK` | IA no ar 🟢 |
| `[admin] Painel de controle em http://127.0.0.1:3000` | Painel no ar 🟢 |
| `[web] Chat disponível em http://127.0.0.1:4000` | Chat web no ar 🟢 |
| `[seed] N horários livres gerados/atualizados.` | Agenda preenchida 🟢 |

> Se a IA cair, o bot continua no WhatsApp mas responde "não consegui responder 😅" — o supervisor tenta relê-la sozinho.

## 📚 Documentação

Detalhes técnicos e cada funcionalidade ficam na pasta [`docs/`](docs/):

| Documento | Conteúdo |
|---|---|
| 📇 [`FEATURES.md`](docs/FEATURES.md) | Índice das funcionalidades (núcleo + features) |
| 🔧 [`REFERENCIA.md`](docs/REFERENCIA.md) | Arquitetura, banco de dados, configuração (`.env`) e comandos |
| 🧙 [`OPERACAO.md`](docs/OPERACAO.md) | Como rodar, parar, acompanhar logs e troubleshooting |
| 🎚️ [`AJUSTES.md`](docs/AJUSTES.md) | Ajustes sem código: serviços, agenda, boas-vindas, imagens |
| 📧 [`SMTP.md`](docs/SMTP.md) | Senha de app do Gmail para os emails do bot |
| 🧪 [`AVALIACAO.md`](docs/AVALIACAO.md) · 🎤 [`PITCH.md`](docs/PITCH.md) | Avaliação e pitch do projeto |

---

> [!WARNING]
> O modelo `big-pickle` é gratuito, mas durante o período free as interações podem ser usadas para melhorar o modelo. Para dados sensíveis de clientes em produção, prefira um modelo com zero-retention ou um modelo local de verdade. Detalhes em [docs/REFERENCIA.md](docs/REFERENCIA.md).