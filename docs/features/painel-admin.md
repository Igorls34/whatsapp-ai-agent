> 📚 **[Índice](../FEATURES.md)** · [README](../../README.md)

# 🛠️ Painel Admin (CRUD de Serviços)

Página web simples para **gerenciar o catálogo de serviços** (`servicos`) no navegador — criar, editar, ativar/desativar e excluir — sem mexer em SQL. As mudanças valem **imediatamente**, sem reiniciar o bot.

## Como usar

```bash
npm run admin        # sobe o servidor HTTP local
# abra http://127.0.0.1:3000 no navegador
```

- A página lista todos os serviços (inclusive inativos), com **toggle** de ativo na própria linha.
- **Novo / Editar**: formulário com nome (obrigatório), descrição, **categoria** (com sugestões das já usadas), ordem de exibição e ativo.
- A **categoria** organiza o catálogo para o bot apresentar de forma agrupada (ex: "Design Gráfico", "Engenharia"…). Campos sem categoria caem em "Outros serviços".
- **Excluir**: pede a confirmação digitando o nome do serviço.
- Banner informativo reforça: o bot **nunca informa valores** ao cliente.

## API (REST)

O painel é servido por uma API REST mínima, escrita só com o módulo `http` do Node (zero dependências):

| Método | Rota | Ação |
|---|---|---|
| `GET` | `/` | Página web |
| `GET` | `/api/servicos` | Lista todos os serviços |
| `GET` | `/api/categorias` | Sugestões de categorias já usadas |
| `POST` | `/api/servicos` | Cria `{ nome, descricao, categoria, ativo, ordem }` |
| `PUT` | `/api/servicos/:id` | Atualiza o serviço |
| `DELETE` | `/api/servicos/:id` | Exclui o serviço |

Exemplos:

```bash
# listar
curl http://127.0.0.1:3000/api/servicos

# criar
curl -X POST http://127.0.0.1:3000/api/servicos \
  -H "Content-Type: application/json" \
  -d '{"nome":"Formatacao de PC","descricao":"Servico completo","ativo":true,"ordem":0}'
```

## Segurança

- O servidor só escuta em **`127.0.0.1`** (loopback).
- Opcional: defina `ADMIN_TOKEN` no `.env` → sem o header `Authorization: Bearer <token>` as rotas respondem `401`.

## Por que existe

O catálogo é a **fonte da verdade** que o LLM usa para apresentar serviços (regra do prompt: só exibe o que está na tabela `servicos`). Antes, editar exigia SQL/manual; o painel dá autonomia ao Igor, sem código e sem depender do bot estar parado.

## Arquivos

- `src/admin/server.js` — servidor HTTP (API + serve a página)
- `src/admin/index.html` — interface (HTML + CSS + JS vanilla, sem framework)
- `src/db/repositories.js` → métodos `listarServicosAdmin`, `criarServico`, `atualizarServico`, `excluirServico`
- Config em `src/config.js` → `config.admin`
- Script `npm run admin` em `package.json`

## Pontos de atenção

- **Valores:** o campo `preco` da tabela **não é exibido nem editado** no painel, e o bot nunca o repassa ao cliente (decisão de negócio: orçamento só com o Igor).