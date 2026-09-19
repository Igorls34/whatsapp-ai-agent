import nodemailer from 'nodemailer';

// Serviço de notificações: envia alertas ao responsável via WhatsApp e email
// quando um agendamento é realizado (no bot ou no chat web).
export function createNotificationService({ getSocket, config, dbEnqueue }) {
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

  // Processos sem socket (chat web) não conseguem enviar WhatsApp direto:
  // gravam o aviso na fila (avisos_pendentes) e o bot entrega depois.
  async function enviarWhatsApp(telefone, texto) {
    if (!telefone) return { ok: false, motivo: 'whatsapp_indisponivel' };
    const socket = getSocket();
    if (!socket) {
      if (dbEnqueue) {
        try {
          dbEnqueue(texto);
          console.log('[notif] WhatsApp indisponivel -> aviso enfileirado p/ bot');
          return { ok: true, motivo: 'enfileirado' };
        } catch (err) {
          console.error('[notif] falha ao enfileirar aviso:', err.message);
        }
      }
      return { ok: false, motivo: 'whatsapp_indisponivel' };
    }
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
        from: `"${config.negocio.nome} (Assistente Virtual)" <${notificacoes.smtp.user}>`,
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
      const textoWhatsApp = `📅 *Novo agendamento*\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;
      const textoEmail = `Novo agendamento realizado.\n\nCliente: ${cliente}\nHorário: ${data_hora}${motivo ? `\nMotivo: ${motivo}` : ''}`;

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
