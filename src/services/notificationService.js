import nodemailer from 'nodemailer';

// Serviço de notificações: envia alertas pro Igor via WhatsApp e email
// quando um agendamento é realizado (no bot ou no chat web).
//
// A entrega no WhatsApp passa pela outbox (src/notifications/outbox.js): envia
// na hora quando o socket está disponível e, se não estiver, persiste o aviso
// para entrega assim que o WhatsApp conectar — sem polling entre processos.
export function createNotificationService({ config, settings, outbox }) {
  const { notificacoes } = config;

  // Transporter do nodemailer (Gmail SMTP por padrão)
  let transporter = null;

  function getTransporter() {
    if (transporter) return transporter;
    const { host, port, secure, user, pass } = notificacoes.smtp;
    if (!host || !user || !pass) return null;
    transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    return transporter;
  }

  // Destinos dos avisos: vêm do painel (settings) quando preenchidos; senão do .env.
  function destinos() {
    return settings ? settings.notificacoes() : { whatsapp: notificacoes.whatsapp, email: notificacoes.email };
  }

  async function enviarWhatsApp(texto) {
    const { whatsapp } = destinos();
    if (!whatsapp) return { ok: false, motivo: 'whatsapp_indisponivel' };
    return outbox.enviar({ telefone: whatsapp, texto });
  }

  async function enviarEmail(assunto, texto) {
    const { email } = destinos();
    const t = getTransporter();
    if (!t) return { ok: false, motivo: 'email_nao_configurado' };
    if (!email) return { ok: false, motivo: 'email_nao_configurado' };
    try {
      await t.sendMail({
        from: `"Bot Igor Dev" <${notificacoes.smtp.user}>`,
        to: email,
        subject: assunto,
        text: texto,
      });
      return { ok: true };
    } catch (err) {
      console.error('[notif] falha email:', err.message);
      return { ok: false, motivo: err.message };
    }
  }

  return {
    async notificarAgendamento({ data_hora, telefone, nome, motivo }) {
      const cliente = nome ? `${nome} (${telefone})` : telefone;
      const textoWhatsApp = `📅 *Novo agendamento*\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;
      const textoEmail = `Novo agendamento realizado.\n\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;

      const whatsapp = await enviarWhatsApp(textoWhatsApp);
      const email = await enviarEmail(`📅 Novo agendamento - ${data_hora}`, textoEmail);

      console.log(`[notif] agendamento ${data_hora}: WhatsApp=${whatsapp.ok} | Email=${email.ok}`);
      return { whatsapp, email };
    },

    // Atalho genérico (emergências, etc.)
    async notificarWhatsApp(texto) {
      return enviarWhatsApp(texto);
    },
  };
}
