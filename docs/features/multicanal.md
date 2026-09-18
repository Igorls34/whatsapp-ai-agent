> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 📲 Multi-canal (futuro: Instagram, SMS e outros)

> [!IMPORTANT]
> Este é um **plano de evolução** — hoje o agente atende por **WhatsApp** e **chat web**, mas o **núcleo foi desenhado de forma agnóstica de canal**: portar para Instagram, SMS ou qualquer outro meio é um esforço de **transporte**, não de reescrita do agente.

## Por que o agente é "agnóstico de canal"

A conversa com o cliente é separada do canal por onde ela chega:

```
Canal (WhatsApp hoje · Instagram/SMS no futuro)
   → messageHandler (adaptador do canal)
   → agent.js   ← mesmo núcleo para qualquer canal
   → toolExecutor (agenda, memória, catálogo)
   → SQLite (dados compartilhados entre canais)
```

- O **LLM** (`agent.js` + `opencode serve`) não sabe se a mensagem veio do WhatsApp, do navegador ou de um SMS — recebe texto, devolve texto.
- **Agenda, memória de longo prazo e catálogo de serviços** são um só banco: um cliente que fala com o bot no WhatsApp e depois no Instagram encontra o mesmo contexto.
- O `toolExecutor` já recebe um parâmetro **`canal`** (`whatsapp` | `web`), usado para regras diferentes por meio (ex.: bloqueio por abuso é permanente no WhatsApp e temporário no web — ver [backpressure](backpressure.md)). Um terceiro/quartro canal é só mais um valor desse campo.
- O chat web já é a prova viva: `src/web/server.js` reaproveita o mesmo agente sem depender do WhatsApp (socket nulo).

## Roadmap sugerido

| Canal | Esforço | Observações |
|---|---|---|
| **Instagram (DM)** | Médio | Exige um **transporte** (ex.: API não-oficial / Private API, ou central de terceiros via webhook). DMs individuais têm riscos — ver aviso abaixo |
| **SMS** | Médio | Precisa de um provedor SMS (Twilio etc.) como transporte; mesmo agente, mesma agenda |
| **Outros** (Telegram, e-mail, formulário) | Baixo a médio | Mesmo padrão: adaptador de canal → agente |

Estrutura esperada ao implementar: um módulo por canal (ex.: `src/instagram/`, `src/sms/`) espelhando o `src/whatsapp/`, tudo apontando para o mesmo `createAgent`/`createToolExecutor`.

## ⚠️ Aviso importante sobre o transporte não-oficial

> [!CAUTION]
> O acesso ao WhatsApp usado hoje é **não-oficial da Meta** (biblioteca Baileys, emulando o app). Isso é conveniente e autônomo, mas **viola os Termos de Serviço** de plataformas como WhatsApp e Instagram. **Uso irresponsável** (volume alto, comportamento suspeito, quedas frequentes de sessão, spam) pode levar a:
>
> - **Banimento do número** no WhatsApp;
> - **Bloqueio/restrição da conta** no Instagram;
> - Perda da sessão e necessidade de reautenticação.

Boas práticas ao operar qualquer canal não-oficial:
- Comece com **volume baixo** e aumente gradualmente;
- Reaqueça sessões e evite envios em rajada (o projeto já espaça envios — ver [backpressure](backpressure.md));
- Não use para spam/disparo não solicitado;
- Faça **backup da sessão** (`.sessions-backup/`) e monitore logs.

Para cenários críticos de produção, considere **caminhos oficiais/compliantes** ao portar o agente: API comentada de negócio (ex.: provedores de WhatsApp Business API) ou centrais de caixa de entrada que fazem a ponte legal com o canal.

## Arquivos (referência para a evolução)

| Arquivo atual | Papel no multi-canal |
|---|---|
| `src/whatsapp/messageHandler.js` | Adaptador de exemplo do canal WhatsApp |
| `src/web/server.js` | Adaptador de exemplo do canal web |
| `src/llm/agent.js` | Núcleo compartilhado (não muda por canal) |
| `src/services/toolExecutor.js` | Regras por `canal` (`whatsapp` \| `web` \| futuro) |
| `src/db/` | Dados compartilhados entre canais |