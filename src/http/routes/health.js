// Healthcheck do app (usado pelo deploy e por monitoramento).
//
// Responde 200 quando o processo está de pé e o banco acessível; 503 se o banco
// falhar. O LLM e o WhatsApp são reportados como componentes, mas NÃO derrubam
// o healthcheck: sem pareamento ou sem opencode o app segue no ar (o bot avisa
// o cliente), então reiniciar o serviço não resolveria nada.
import { json } from '../respond.js';
import { versaoApp } from '../../version.js';

const LLM_TIMEOUT_MS = 1_500;

function timeout(ms) {
  let timer;
  const promessa = new Promise((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`timeout após ${ms}ms`)), ms);
  });
  return { promessa, cancelar: () => clearTimeout(timer) };
}

export function registrarRotasHealth(router, { brain, qrState }) {
  router.get('/health', async ({ res }) => {
    let dbOk = true;
    let dbErro = null;
    try {
      brain.db.prepare('SELECT 1 AS ok').get();
    } catch (err) {
      dbOk = false;
      dbErro = String(err?.message || err);
    }

    let llm = { ok: false, erro: null };
    const t = timeout(LLM_TIMEOUT_MS);
    try {
      const info = await Promise.race([brain.adapter.health(), t.promessa]);
      llm = { ok: true, versao: info?.version ?? null };
    } catch (err) {
      llm = { ok: false, erro: String(err?.message || err) };
    } finally {
      t.cancelar();
    }

    const { conectado, qr } = qrState.estado();

    let avisosPendentes = null;
    try {
      avisosPendentes = brain.repos.contarAvisosPendentes();
    } catch (err) {
      /* já reportado em db.erro */
    }

    return json(
      res,
      dbOk ? 200 : 503,
      {
        ok: dbOk,
        app: versaoApp(),
        uptimeSegundos: Math.floor(process.uptime()),
        db: { ok: dbOk, erro: dbErro },
        llm,
        whatsapp: { conectado, qrPendente: Boolean(qr) },
        notificacoes: { pendentes: avisosPendentes },
      }
    );
  });
}
