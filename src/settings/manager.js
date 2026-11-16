// Configurações editáveis pelo painel admin (aba "Configurações").
//
// Ficam em `data/settings.json` (fora do Git) e SOBRESCREVEM os valores do
// `.env` quando presentes. Assim o Igor muda notificações e horários de
// trabalho sem editar arquivo nem reiniciar o bot.
//
// Escopo atual:
//   notificacoes: { whatsapp, email }   → destino dos avisos de agendamento
//   agenda:       { workSchedule, scheduleStart, scheduleEnd, slotMinutes, horizonDays }
import fs from 'node:fs';
import path from 'node:path';
import { parseWorkSchedule } from '../config.js';

const AGENDA_DEFAULT = {
  workSchedule: '1-4:12-21,5:10-19,6:8-14',
  scheduleStart: 7,
  scheduleEnd: 24,
  slotMinutes: 60,
  horizonDays: 14,
};

// Valida e normaliza a parte `agenda`. Lança Error com mensagem clara.
function normalizarAgenda(entrada = {}) {
  const scheduleStart = Number(entrada.scheduleStart ?? AGENDA_DEFAULT.scheduleStart);
  const scheduleEnd = Number(entrada.scheduleEnd ?? AGENDA_DEFAULT.scheduleEnd);
  const slotMinutes = Number(entrada.slotMinutes ?? AGENDA_DEFAULT.slotMinutes);
  const horizonDays = Number(entrada.horizonDays ?? AGENDA_DEFAULT.horizonDays);
  const workSchedule = String(entrada.workSchedule ?? AGENDA_DEFAULT.workSchedule).trim();

  if (!/^(\d(-\d)?:\d{1,2}-\d{1,2})(,(\d(-\d)?:\d{1,2}-\d{1,2}))*$/.test(workSchedule)) {
    throw new Error(
      'Horários de trabalho inválidos. Use o formato "dias:inicio-fim,dias:inicio-fim" (ex.: 1-4:12-21,5:10-19).'
    );
  }
  if (!Number.isInteger(scheduleStart) || scheduleStart < 0 || scheduleStart > 23) {
    throw new Error('Início do dia de agendamento inválido (0 a 23).');
  }
  if (!Number.isInteger(scheduleEnd) || scheduleEnd < 1 || scheduleEnd > 24 || scheduleEnd <= scheduleStart) {
    throw new Error('Fim do dia de agendamento inválido (deve ser maior que o início e até 24).');
  }
  if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 240) {
    throw new Error('Duração do slot inválida (5 a 240 minutos).');
  }
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 90) {
    throw new Error('Horizonte de dias inválido (1 a 90).');
  }

  return { workSchedule, scheduleStart, scheduleEnd, slotMinutes, horizonDays };
}

function normalizarNotificacoes(entrada = {}) {
  const limpar = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    whatsapp: limpar(entrada.whatsapp),
    email: limpar(entrada.email),
  };
}

export function createSettingsManager({ filePath, config }) {
  let cache = null;

  function carregar() {
    try {
      cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      cache = {};
    }
    return cache;
  }

  function persistir() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  }

  function atual() {
    return cache ?? carregar();
  }

  // ---------------------------------------------------------------------------
  // Leituras efetivas (settings > .env)
  // ---------------------------------------------------------------------------

  function notificacoes() {
    const salvo = atual().notificacoes || {};
    return {
      whatsapp:
        typeof salvo.whatsapp === 'string' && salvo.whatsapp !== ''
          ? salvo.whatsapp
          : config.notificacoes.whatsapp || '',
      email:
        typeof salvo.email === 'string' && salvo.email !== ''
          ? salvo.email
          : config.notificacoes.email || '',
    };
  }

  function agendaCrua() {
    const salvo = atual().agenda || {};
    const primeira = (salvo, env, padrao) =>
      salvo !== undefined && salvo !== '' && salvo !== null ? salvo : env !== undefined ? env : padrao;

    return {
      workSchedule: primeira(salvo.workSchedule, config.agenda.workSchedule, AGENDA_DEFAULT.workSchedule),
      scheduleStart: primeira(salvo.scheduleStart, config.agenda.scheduleStart, AGENDA_DEFAULT.scheduleStart),
      scheduleEnd: primeira(salvo.scheduleEnd, config.agenda.scheduleEnd, AGENDA_DEFAULT.scheduleEnd),
      slotMinutes: primeira(salvo.slotMinutes, config.agenda.slotMinutes, AGENDA_DEFAULT.slotMinutes),
      horizonDays: primeira(salvo.horizonDays, config.agenda.horizonDays, AGENDA_DEFAULT.horizonDays),
    };
  }

  function agenda() {
    const crua = agendaCrua();
    return {
      workBlocked: parseWorkSchedule(crua.workSchedule),
      scheduleStart: Number(crua.scheduleStart),
      scheduleEnd: Number(crua.scheduleEnd),
      slotMinutes: Number(crua.slotMinutes),
      horizonDays: Number(crua.horizonDays),
    };
  }

  // Estado atual para o painel (o que está salvo, com fallback exibido).
  function paraPainel() {
    return { notificacoes: notificacoes(), agenda: agendaCrua() };
  }

  // ---------------------------------------------------------------------------
  // Escrita
  // ---------------------------------------------------------------------------

  function salvar(patch = {}) {
    const base = atual();
    const proximo = { ...base };

    if (patch.notificacoes) {
      proximo.notificacoes = normalizarNotificacoes(patch.notificacoes);
    }
    if (patch.agenda) {
      proximo.agenda = normalizarAgenda({ ...(base.agenda || {}), ...patch.agenda });
    }

    cache = proximo;
    persistir();
    return paraPainel();
  }

  return { carregar, atual, notificacoes, agenda, paraPainel, salvar };
}
