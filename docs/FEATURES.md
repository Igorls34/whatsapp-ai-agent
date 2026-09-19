<div align="center">

# 📚 Documentação do WhatsApp AI Agent

**Ponto de entrada para todas as funcionalidades** — o projeto tem um **núcleo** (o agente de IA) e **funcionalidades complementares** implementadas em cima dele. Cada uma tem a sua própria página: como funciona, arquivos envolvidos e configuração.

[![Voltar ao README](https://img.shields.io/badge/⬅_Voltar_ao_README-000000?style=for-the-badge)](../README.md)

</div>

## 🚀 Núcleo — Agente de IA no WhatsApp

> O coração do projeto: o **loop de raciocínio**, a integração com o **LLM local** (opencode), o **protocolo de ferramentas** em texto, o catálogo de serviços, boas-vindas e mensagens múltiplas.

| Página | Conteúdo |
|---|---|
| 🎯 [**agente-ia.md**](features/agente-ia.md) | Como o agente pensa, ferramentas, guardrails e guarda-chuva de todas as features |

## 🧩 Funcionalidades complementares

| Funcionalidade | O que faz | Página dedicada |
|---|---|---|
| 📅 **Agendamento inteligente** | Agenda reuniões respeitando os horários de trabalho, gera slots sozinho e fica indisponível com a agenda cheia | [agendamento.md](features/agendamento.md) |
| 🧠 **Memória de longo prazo** | Lembra de cada cliente entre conversas (resumo em SQLite + histórico por sessão) | [memoria.md](features/memoria.md) |
| 🔔 **Notificações** | Avisa o Igor de agendamentos (WhatsApp + email) e recebe emergências | [notificacoes.md](features/notificacoes.md) |
| 🖼️ **Imagens / GIFs** | Envia logo, catálogo visual e GIF de boas-vindas via `manifest.json` | [imagens.md](features/imagens.md) |
| 🛠️ **Painel admin (CRUD)** | Página web para gerenciar os serviços sem SQL, com API REST | [painel-admin.md](features/painel-admin.md) |
| 🎨 **Persona personalizável** | Identidade, tom de voz e preferências da IA editáveis pela página **Persona** (sem código, via JSON) | [persona.md](features/persona.md) |
| 💬 **Chat Web** | Página simples para conversar com o mesmo agente no navegador (portfolio) | [chat-web.md](features/chat-web.md) |
| 🛡️ **Controle de gargalos & bloqueio** | Limites de concorrência/timeout no LLM, envio espaçado, fila de avisos à prova de travamento e bloqueio por abuso | [backpressure.md](features/backpressure.md) |
| 📲 **Multi-canal (futuro)** | Plano para portar o agente (agnóstico de canal) para Instagram, SMS e outros | [multicanal.md](features/multicanal.md) |

## 🧙 Guias auxiliares

| Guia | Conteúdo |
|---|---|
| 🔧 [**REFERENCIA.md**](REFERENCIA.md) | Arquitetura, banco de dados, variáveis de ambiente (`.env`) e comandos |
| 🧙 [**OPERACAO.md**](OPERACAO.md) | Como rodar, parar e acompanhar o bot no dia a dia (operador) |
| 🎚️ [**AJUSTES.md**](AJUSTES.md) | Ajustes rápidos sem código: serviços, agenda, boas-vindas, imagens |
| 📧 [**SMTP.md**](SMTP.md) | Como gerar a senha de app do Gmail para os emails do bot |
| 🧪 [**AVALIACAO.md**](AVALIACAO.md) | Casos de teste, critérios e métricas do assistente (passo 5) |
| 🎤 [**PITCH.md**](PITCH.md) | Pitch: problema, solução, público e valor (passo 6) |

> [!TIP]
> Comece pelo **[README](../README.md)** — visão geral, arquitetura e como rodar em poucos passos.