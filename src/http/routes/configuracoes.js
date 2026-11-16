// Rotas das configurações editáveis pelo painel (aba "Configurações").
//
// GET  /api/configuracoes  → estado atual (notificações + agenda)
// PUT  /api/configuracoes  → salva { notificacoes?, agenda? } e re-seeda a agenda
import { json, readBody } from '../respond.js';

export function registrarRotasConfiguracoes(router, { settings, onAgendaAlterada }) {
  const admin = { guard: 'admin' };

  router.get(
    '/api/configuracoes',
    ({ res }) => json(res, 200, { ok: true, configuracoes: settings.paraPainel() }),
    admin
  );

  router.put(
    '/api/configuracoes',
    async ({ req, res }) => {
      const body = await readBody(req);
      const patch = {};

      if (body.notificacoes && typeof body.notificacoes === 'object') {
        patch.notificacoes = {
          whatsapp: String(body.notificacoes.whatsapp ?? '').trim(),
          email: String(body.notificacoes.email ?? '').trim(),
        };
      }
      if (body.agenda && typeof body.agenda === 'object') {
        patch.agenda = {
          workSchedule: String(body.agenda.workSchedule ?? '').trim(),
          scheduleStart: Number(body.agenda.scheduleStart),
          scheduleEnd: Number(body.agenda.scheduleEnd),
          slotMinutes: Number(body.agenda.slotMinutes),
          horizonDays: Number(body.agenda.horizonDays),
        };
      }

      try {
        const resultado = settings.salvar(patch);

        // Horários mudados → re-seeda a agenda para valer na hora.
        if (patch.agenda && typeof onAgendaAlterada === 'function') {
          try {
            onAgendaAlterada();
          } catch (err) {
            console.error('[config] falha ao re-seedar agenda:', err.message);
          }
        }

        return json(res, 200, { ok: true, configuracoes: resultado });
      } catch (err) {
        return json(res, 400, { ok: false, erro: String(err.message || err) });
      }
    },
    admin
  );
}
