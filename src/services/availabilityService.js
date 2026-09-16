import { addDaysIso, toLocalIso } from '../db/repositories.js';

// consultar_disponibilidade()
export function createAvailabilityService(repos) {
  return {
    async consultar({ dias = 3 } = {}) {
      const de = toLocalIso(new Date());
      const ate = addDaysIso(Number(dias) || 3);

      const slots = repos.listarDisponiveis({ de, ate });
      if (!slots.length) {
        return { ok: true, agenda_cheia: true, disponiveis: [] };
      }

      const porDia = new Map();
      for (const s of slots) {
        const [dia, hora] = s.data_hora.split('T');
        if (!porDia.has(dia)) porDia.set(dia, []);
        porDia.get(dia).push(hora);
      }

      const disponiveis = [...porDia.entries()].map(([dia, horarios]) => ({
        dia,
        horarios,
      }));

      return { ok: true, agenda_cheia: false, disponiveis };
    },
  };
}