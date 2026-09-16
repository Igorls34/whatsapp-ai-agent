import nodemailer from 'nodemailer';

// Serviço de notificações: envia alertas pro Igor via WhatsApp e email
// quando um agendamento é realizado no bot.
export function createNotificationService({ getSocket, config }) {
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

  async function enviarWhatsApp(telefone, texto) {
    const socket = getSocket();
    if (!socket || !telefone) return { ok: false, motivo: 'whatsapp_indisponivel' };
    try {
      await socket.sendMessage(`${telefone}@s.whatsapp.net`, { text: texto });
      return { ok: true };
    } catch (err) {
      console.error('[notif] falha WhatsApp:', err.message);
      return { ok: false, motivo: err.message };
    }
  }

  async function enviarEmail(assunto, texto) {
    const t = getTransporter();
    if (!t) return { ok: false, motivo: 'email_nao_configurado' };
    try {
      await t.sendMail({
        from: `"Bot Igor Dev" <${notificacoes.smtp.user}>`,
        to: notificacoes.email,
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
      const textoWhatsApp = `📅 *Novo agendamento no bot*\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;
      const textoEmail = `Novo agendamento realizado pelo bot.\n\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;

      const whatsapp = await enviarWhatsApp(notificacoes.whatsapp, textoWhatsApp);
      const email = await enviarEmail(`📅 Novo agendamento - ${data_hora}`, textoEmail);

      console.log(`[notif] agendamento ${data_hora}: WhatsApp=${whatsapp.ok} | Email=${email.ok}`);
      return { whatsapp, email };
    },

    // Atalho genérico (emergências, etc.)
    async notificarWhatsApp(texto) {
      return enviarWhatsApp(notificacoes.whatsapp, texto);
    },
  };
}
