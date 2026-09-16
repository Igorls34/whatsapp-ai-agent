// notificar_emergencia(): avisa o Igor quando o cliente precisa de atendimento urgente
export function createEmergencyService({ getSocket, config }) {
  return {
    async notificar({ telefone, mensagem, nome = null }) {
      const socket = getSocket();
      const numero = config.emergencyNumber;
      const texto = `🚨 URGÊNCIA no bot\nCliente: ${nome ? nome + ' ' : ''}(${telefone})\nMensagem: ${mensagem}`;

      if (socket && numero) {
        await socket.sendMessage(`${numero}@s.whatsapp.net`, { text: texto });
        return { ok: true, notificado_whatsapp: true };
      }

      console.log('[EMERGENCIA]', texto);
      return { ok: true, notificado_whatsapp: false };
    },
  };
}