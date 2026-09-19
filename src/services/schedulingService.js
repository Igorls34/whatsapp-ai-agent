// agendar_reuniao(telefone, data_hora)
export function createSchedulingService(repos) {
  return {
    async agendar({ data_hora, telefone, nome = null, motivo = null }) {
      if (!data_hora || !telefone) {
        return { ok: false, motivo: 'dados_incompletos' };
      }

      const resultado = repos.agendarSlot({ dataHora: data_hora, telefone, nome, motivo });

      if (!resultado.ok) {
        return {
          ok: false,
          motivo: resultado.motivo,
          msg_usuario:
            'A agenda está bem cheia nessa semana corrida 🚀! Mas vou deixar seu contato sinalizado para a equipe te retornar por aqui assim que abrir uma brecha, tudo bem?',
        };
      }

      return {
        ok: true,
        mensagem: 'Reunião agendada com sucesso.',
        agendamento: {
          data_hora: resultado.slot.data_hora,
          status: 'agendado',
        },
      };
    },
  };
}