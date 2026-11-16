// notificar_emergencia(): avisa o Igor quando o cliente precisa de atendimento urgente.
//
// Usa a outbox: se o WhatsApp estiver conectado, envia na hora; se não, o aviso
// fica persistido e é entregue assim que a conexão voltar (antes era só log).
export function createEmergencyService({ config, outbox }) {
  return {
    async notificar({ telefone, mensagem, nome = null }) {
      const numero = config.emergencyNumber;
      const texto = `🚨 URGÊNCIA no bot\nCliente: ${nome ? nome + ' ' : ''}(${telefone})\nMensagem: ${mensagem}`;

      if (!numero) {
        console.log('[EMERGENCIA]', texto);
        return { ok: true, notificado_whatsapp: false };
      }

      const resultado = await outbox.enviar({ telefone: numero, texto });
      const entregue = resultado.ok && resultado.motivo !== 'enfileirado';
      if (!entregue) console.log('[EMERGENCIA]', texto);

      return {
        ok: true,
        notificado_whatsapp: entregue,
        ...(resultado.motivo === 'enfileirado' ? { enfileirado: true } : {}),
      };
    },
  };
}
