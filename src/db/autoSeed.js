import { config } from '../config.js';

function slotTimeToHM(startHour, slotIndex, slotMinutes) {
  const totalMin = startHour * 60 + slotIndex * slotMinutes;
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

function isWorkBlocked(dayOfWeek, hour, minute, workBlocked) {
  const blocks = workBlocked[dayOfWeek];
  if (!blocks) return false;
  const t = hour + minute / 60;
  return blocks.some((b) => t >= b.start && t < b.end);
}

export function toLocalIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Apaga slots livres já passados (ontem e anteriores). Mantém agendados/confirmados.
// Retorna quantos foram removidos.
export function limparSlotsPassados(repos) {
  const agora = new Date();
  const limite = new Date(agora);
  limite.setHours(0, 0, 0, 0); // início de hoje — deleta tudo antes
  return repos.apagarSlotsPassados(toLocalIso(limite));
}

// Gera slots livres para os próximos horizonDays, pulando horários de trabalho.
// Retorna a quantidade de slots criados.
export function gerarSlots(repos) {
  const { workBlocked, scheduleStart, scheduleEnd, slotMinutes, horizonDays } = config.agenda;
  const now = new Date();
  let criados = 0;

  for (let d = 0; d <= horizonDays; d++) {
    const dia = new Date(now);
    dia.setDate(now.getDate() + d);
    const dayOfWeek = dia.getDay();

    const totalSlots = ((scheduleEnd - scheduleStart) * 60) / slotMinutes;

    for (let i = 0; i < totalSlots; i++) {
      const { h, m } = slotTimeToHM(scheduleStart, i, slotMinutes);
      const slot = new Date(dia);
      slot.setHours(h, m, 0, 0);

      if (slot.getTime() <= now.getTime()) continue;
      if (isWorkBlocked(dayOfWeek, h, m, workBlocked)) continue;

      repos.inserirSlot(toLocalIso(slot));
      criados++;
    }
  }

  return criados;
}
