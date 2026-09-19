> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🖼️ Imagens / GIFs

O bot pode enviar ao cliente **imagens e GIFs catalogados** (logo, catálogo visual, GIF de boas-vindas) usando a ferramenta `enviar_imagem` — SEM precisar de código. O LLM escolhe o material pelo apelido.

> Opcional e **desativado por padrão** (`IMAGENS_ATIVO=false`). Sem esta feature, as boas-vindas são só texto.

## Como funciona

1. **Manifesto** (`assets/imagens/manifest.json`): mapeia apelido → arquivo.

```json
{
  "logo":              { "arquivo": "logo.png",               "descricao": "Logo do negócio" },
  "catalogo_servicos":  { "arquivo": "catalogo-servicos.png",  "descricao": "Tabela com os serviços oferecidos" },
  "boasvindas_gif":     { "arquivo": "boasvindas.gif",         "descricao": "GIF de boas-vindas" }
}
```

2. **O LLM vê a lista** de apelidos + descrições no contexto (seção "Imagens disponíveis") e decide quando é útil enviar.
3. **`enviar_imagem`** (`imageService.js`) localiza o arquivo em `assets/imagens/` e envia via WhatsApp — imagem (`.png`/`.jpg`) ou GIF (`.gif`, enviado como vídeo com `gifPlayback`).

## Usos típicos

- **Boas-vindas animada**: cliente novo/inativo recebe o `boasvindas_gif` + legenda (`WELCOME_TEXT`) — ver [agente-ia](agente-ia.md).
- **Catálogo visual**: cliente pergunta por serviços → bot envia a imagem de catálogo.
- **Logo / material visual** no meio da conversa.

## Configuração (`.env`)

| Variável | Padrão | Descrição |
|---|---|---|
| `IMAGENS_ATIVO` | `false` | `true` habilita envio de imagens/GIFs |
| `IMAGENS_DIR` | `./assets/imagens` | Pasta com as imagens + `manifest.json` |
| `WELCOME_IMAGE` | `boasvindas_gif` | Apelido da imagem de boas-vindas (no manifest) |

## Como adicionar uma imagem nova

1. Coloque o arquivo em `assets/imagens/` (ex.: `assets/imagens/logo.png`).
2. Adicione no `manifest.json` um apelido + `arquivo` + `descricao`.
3. Garanta `IMAGENS_ATIVO=true` e reinicie o bot.

O LLM passa a ver o novo apelido automaticamente (a lista é montada do manifest a cada mensagem).

## Arquivos

- `src/services/imageService.js` — `listar()`, `enviar()` e `enviarBoasVindas()`
- `src/services/toolExecutor.js` — expõe a ferramenta `enviar_imagem`
- `assets/imagens/manifest.json` — catálogo visível ao LLM
- Config em `src/config.js` → `config.imagens` e `config.welcomes`

## Pontos de atenção

- Arquivo ausente → o bot retorna `arquivo_ausente` e cai para resposta de texto (sem quebrar a conversa).
- GIFs são enviados como vídeo com `gifPlayback: true` (o WhatsApp reproduz em loop).