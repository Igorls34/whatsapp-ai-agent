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

## 🚀 Passo a passo para rodar (bem simples)

Não precisa ser programador: se você conseguir abrir uma janela de **terminal** e copiar/colar comandos, você roda o projeto. São **apenas 4 passos**, e tudo se resume a **3 comandos**.

### 0 · Abra o terminal

É aqui que você digita os comandos. Em cada sistema é diferente:

- **🪟 Windows:** abra o **PowerShell** (clique em Iniciar, digite `powees`… *perdão* — digite `PowerShell` e aperte Enter). Ou, dentro da pasta do projeto no Explorer: `Shift` + clique com o botão direito → **"Abrir janela do PowerShell aqui"**.
- **🐧 Linux:** abra o **Terminal** (geralmente em Aplicativos → Acessórios → Terminal, ou com `Ctrl`+`Alt`+`T`).
- **🍎 macOS:** abra o **Terminal** (Finder → Aplicativos → Utilitários → Terminal).

> 💡 A partir daqui, todo comando começa com `$` no exemplo — **você não digita o `$`**, ele só indica que é um comando. Cole o resto.

### 1 · Baixe (clone) o projeto

Você precisa do **Git** instalado ([baixe aqui](https://git-scm.com/downloads) se não tiver). No terminal, copie e cole:

```bash
$ git clone https://github.com/Igorls34/whatsapp-ai-agent.git
$ cd whatsapp-ai-agent
```

- O primeiro comando baixa o projeto numa pasta chamada `whatsapp-ai-agent`.
- O segundo **entra** nessa pasta (é **aí que você vai rodar tudo**).

> 💡 Sem Git? Outro jeito: no site do repositório, botão verde **"Code → Download ZIP"**, extraia a pasta e abra o terminal **dentro dela**.

### 2 · Instale as dependências

Este é o mesmo comando para **Windows, Linux e Mac**:

```bash
$ npm install
```

Vai demorar um pouco (baixa as bibliotecas, inclusive o `better-sqlite3`). Quando terminar, aparece de novo o cursor `$` — sinal de que deu certo. 🎉

### 3 · Configure (só na primeira vez)

Roda uma perguntinha de identidade, dos seus horários de trabalho e das notificações (e instala a IA do projeto, o **opencode**, automaticamente se faltar):

```bash
$ npm run setup
```

### 4 · Ligue tudo 🚀

```bash
$ npm start
```

Esse comando sobe **tudo ao mesmo tempo** e cuida de tudo sozinho:

| Componente | O que é |
|---|---|
| 🤖 **Bot WhatsApp** | atende os clientes por mensagem no celular |
| 🧠 **IA local** (opencode, `:4096`) | o modelo que gera as respostas |
| 🖥️ **Painel admin** (`:3000`) | seu painel de gestão: dashboard, serviços, agenda e clientes |
| 💬 **Chat web** (`:4000`) | conversa com o mesmo agente no navegador |

Mesmo se algum processo der problema, ele **religa sozinho**. Para desligar tudo, aperte `Ctrl`+`C`.

### Conecte o WhatsApp (só na primeira vez)

No primeiro `npm start`, aparece um **QR Code** no terminal:

1. Abra o WhatsApp no celular do responsável (o Igor).
2. Vá em **Ajustes → Aparelhos conectados → Conectar um aparelho**.
3. Aponte a câmera para o QR Code do terminal.

Depois disso a sessão fica salva na pasta `.sessions` — **não precisa escanear de novo**. O bot atende sozinho 24/7. 📱

### Onde abrir cada coisa

- **Painel admin** → `http://127.0.0.1:3000` (dashboard, serviços, agenda, clientes)
- **Chat web** → `http://127.0.0.1:4000` (portfólio no navegador)
- **Origem do problema?** → veja os logs do próprio terminal (tabela logo abaixo)

## ✅ Como saber se está de pé

Fique de olho no terminal em que você rodou `npm start`:

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