# Notificações por email — Gmail com senha de app

O bot envia emails de agendamento usando o SMTP do Gmail **gratuito**, via **senha de aplicativo** (app password). A senha de app é distinta da senha da sua conta — serve só para o bot.

> Contexto completo da funcionalidade de notificações: [notificacoes.md](features/notificacoes.md)

## Passo a passo

1. **Ative a Verificação em 2 etapas** na sua conta Google (obrigatório para criar senha de app):
   - Acesse https://myaccount.google.com/security
   - Em "Verificação em 2 etapas" → Ativar (se ainda não estiver).

2. **Crie a senha de app:**
   - Acesse https://myaccount.google.com/apppasswords
   - Nomeie, ex.: `Assistente Virtual` → **Criar**.
   - Copie a senha gerada (16 caracteres, ex.: `abcd efgh ijkl mnop`).

3. **Preencha o `.env`** do projeto:

```env
NOTIF_EMAIL=seu@email.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=seu@email.com
SMTP_PASS=abcd efgh ijkl mnop        # a senha de app
```

4. **Reinicie o bot** e agende um teste — você deve receber o email.

## Como testar rápido (sem agendar)

No diretório do projeto:

```powershell
node --input-type=module -e "import('dotenv/config').then(async()=>{const n=(await import('nodemailer')).default;const t=n.createTransport({host:process.env.SMTP_HOST,port:+process.env.SMTP_PORT,secure:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});await t.sendMail({from:'\"Bot\"<'+process.env.SMTP_USER+'>',to:process.env.NOTIF_EMAIL,subject:'Teste',text:'ok'});console.log('EMAIL OK')})"
```

## Problemas comuns

| Erro | Causa | Solução |
|---|---|---|
| `Login to your account with a web browser` | senha da conta usada em vez da senha de app | gere/usar a senha de app |
| `Invalid credentials` | senha errada ou com espaços/quebras | cole exatamente a senha de 16 caracteres |
| Sem email recebido | SMTP_USER ≠ NOTIF_EMAIL (remetente ≠ destino) ou spam | confira o remetente; veja em "Enviados" do Gmail |

> A senha de app fica gravada no `.env`, que **não é versionado no git** (ver `.gitignore`).