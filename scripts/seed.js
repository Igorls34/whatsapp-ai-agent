import 'dotenv/config';
import { config } from '../src/config.js';
import { openDatabase } from '../src/db/database.js';
import { createRepositories, toLocalIso } from '../src/db/repositories.js';

// Gera slots de disponibilidade como COMPLEMENTO dos horários de trabalho.
// WORK_SCHEDULE define quando o atendimento está ocupado; o seed cria slots nos
// horários livres dentro da janela SCHEDULE_START–SCHEDULE_END.
// Uso: npm run seed

const db = openDatabase(config.dbPath);
const repos = createRepositories(db);
const { workBlocked, scheduleStart, scheduleEnd, slotMinutes, horizonDays } = config.agenda;

// Mapeia slot de 30 min para hour+minute (ex: 13.5 → 13h30)
function slotTimeToHM(startHour, slotIndex, slotMinutes) {
  const totalMin = startHour * 60 + slotIndex * slotMinutes;
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

// Verifica se um horário cai dentro de algum bloqueio de trabalho
function isWorkBlocked(dayOfWeek, hour, minute) {
  const blocks = workBlocked[dayOfWeek];
  if (!blocks) return false;
  const t = hour + minute / 60;
  return blocks.some((b) => t >= b.start && t < b.end);
}

const now = new Date();
let criados = 0;

for (let d = 0; d <= horizonDays; d++) {
  const dia = new Date(now);
  dia.setDate(now.getDate() + d);
  const dayOfWeek = dia.getDay(); // 0=Dom..6=Sáb

  // Gera slots de scheduleStart até scheduleEnd
  const inicio = new Date(dia);
  inicio.setHours(scheduleStart, 0, 0, 0);

  const totalSlots = ((scheduleEnd - scheduleStart) * 60) / slotMinutes;

  for (let i = 0; i < totalSlots; i++) {
    const { h, m } = slotTimeToHM(scheduleStart, i, slotMinutes);
    const slot = new Date(dia);
    slot.setHours(h, m, 0, 0);

    if (slot.getTime() <= now.getTime()) continue;
    if (isWorkBlocked(dayOfWeek, h, m)) continue;

    repos.inserirSlot(toLocalIso(slot));
    criados++;
  }
}

console.log(`✅ ${criados} horários livres gerados (próximos ${horizonDays} dias).`);
console.log('Bloqueios de trabalho aplicados:');
for (const [dia, blocos] of Object.entries(workBlocked)) {
  const nomes = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
  const nome = nomes[dia] || `Dia ${dia}`;
  const horarios = blocos.map((b) => `${b.start}h–${b.end}h`).join(', ');
  console.log(`  ${nome}: ${horarios}`);
}
console.log('Agora é só rodar: npm start');
