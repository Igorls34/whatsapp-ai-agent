// Rotas do painel (dashboard, serviços, agenda, clientes, persona).
//
// No servidor unificado o painel fica em `/admin` (com assets em `/vendor/*` e
// APIs em `/api/*`). No modo avulso (`npm run admin`) o painel fica na raiz `/`,
// por isso a lista de caminhos da página é parametrizável.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  carregarPersona,
  salvarPersona,
  montarPersona,
  resetarPersona,
  caminhoPersona,
} from '../../prompt/persona.js';
import { buildSystemPrompt } from '../../prompt/systemPrompt.js';
import { html, json, readBody, serveFileFrom } from '../respond.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.resolve(__dirname, '..', '..', 'admin');
const HTML_PATH = path.join(ADMIN_DIR, 'index.html');
const VENDOR_DIR = path.join(ADMIN_DIR, 'vendor');

const STATUS_AGENDA = new Set(['livre', 'agendado', 'confirmada', 'cancelada']);

function sanitizarServico(body) {
  const nome = String(body.nome || '').trim();
  if (!nome) return { erro: 'O campo "nome" é obrigatório.' };
  const descricao = String(body.descricao || '').trim();
  const categoria = String(body.categoria || '').trim();
  const ordem = Number.parseInt(body.ordem, 10);
  const ativo = [true, 1, '1', 'true', 'on'].includes(body.ativo) ? 1 : 0;
  return { dados: { nome, descricao, categoria, ordem: Number.isNaN(ordem) ? 0 : ordem, ativo } };
}

function sanitizarAgendamento(body, parcial = false) {
  const status = String(body.status || '').trim();
  if (status && !STATUS_AGENDA.has(status)) {
    return { erro: 'Status inválido. Use: livre, agendado, confirmada ou cancelada.' };
  }
  let data_hora = String(body.data_hora || '').trim();
  if (data_hora) {
    const match = data_hora.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:00)?$/);
    if (!match) return { erro: 'Formato de horário inválido. Use YYYY-MM-DDTHH:mm.' };
    data_hora = data_hora.slice(0, 16);
  }
  const cliente_telefone = String(body.cliente_telefone || '').trim() || null;
  const cliente_nome = String(body.cliente_nome || '').trim() || null;
  const motivo = String(body.motivo || '').trim() || null;

  if (!status && !data_hora && !cliente_telefone && !cliente_nome && !motivo) {
    return { erro: 'Nenhum dado para alterar.' };
  }
  return { dados: { status: status || undefined, data_hora: data_hora || undefined, cliente_telefone, cliente_nome, motivo } };
}

export function registrarRotasAdmin(router, { repos, pagePaths = ['/admin', '/admin/'] }) {
  const pagina = fs.readFileSync(HTML_PATH, 'utf8');
  const admin = { guard: 'admin' };

  // Página do painel
  for (const caminho of pagePaths) {
    router.get(caminho, ({ res }) => html(res, 200, pagina), admin);
  }

  // Assets locais (Bootstrap) — painel 100% offline. Sem guard: CSS não é sigiloso
  // e a página em si continua protegida pelo token quando configurado.
  router.get('/vendor/:arquivo', ({ res, params }) => serveFileFrom(res, VENDOR_DIR, params.arquivo));

  // GET /api/dashboard — resumo para a mini-gestão
  router.get('/api/dashboard', ({ res }) => json(res, 200, { ok: true, painel: repos.obterResumoPainel() }), admin);

  // GET /api/clientes?q=
  router.get(
    '/api/clientes',
    ({ res, url }) => {
      const q = String(url.searchParams.get('q') || '');
      return json(res, 200, { ok: true, clientes: repos.listarClientes({ q, limite: 200 }) });
    },
    admin
  );

  // PUT /api/clientes/:telefone — reabre o chat (desbloqueia)
  router.put(
    '/api/clientes/:telefone',
    ({ res, params }) => {
      const telefone = params.telefone;
      const resultado = repos.atenderCliente(telefone);
      if (!resultado.ok) return json(res, 409, { ok: false, erro: 'O chat já está liberado.' });
      return json(res, 200, { ok: true, cliente: repos.getCliente(telefone) });
    },
    admin
  );

  // --- Persona (personalização da IA) ---

  router.get(
    '/api/persona',
    ({ res }) => json(res, 200, { ok: true, persona: carregarPersona(), caminho: caminhoPersona() }),
    admin
  );

  router.put(
    '/api/persona',
    async ({ req, res }) => {
      const body = await readBody(req);
      return json(res, 200, { ok: true, persona: salvarPersona(body) });
    },
    admin
  );

  router.post(
    '/api/persona/reset',
    ({ res }) => json(res, 200, { ok: true, persona: resetarPersona() }),
    admin
  );

  router.post(
    '/api/persona/preview',
    async ({ req, res }) => {
      const body = await readBody(req);
      const canal = body.canal === 'web' ? 'web' : 'whatsapp';
      const persona = body.persona ? montarPersona(body.persona) : carregarPersona();
      return json(res, 200, { ok: true, canal, prompt: buildSystemPrompt({ canal, persona }) });
    },
    admin
  );

  // --- Serviços ---

  router.get('/api/servicos', ({ res }) => json(res, 200, { ok: true, servicos: repos.listarServicosAdmin() }), admin);

  router.get(
    '/api/categorias',
    ({ res }) => json(res, 200, { ok: true, categorias: repos.listarCategorias() }),
    admin
  );

  router.post(
    '/api/servicos',
    async ({ req, res }) => {
      const body = await readBody(req);
      const { dados, erro } = sanitizarServico(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const servico = repos.criarServico(dados);
      return json(res, 201, { ok: true, servico });
    },
    admin
  );

  router.put(
    '/api/servicos/:id',
    async ({ req, res, params }) => {
      const body = await readBody(req);
      const { dados, erro } = sanitizarServico(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const servico = repos.atualizarServico({ id: Number(params.id), ...dados });
      if (!servico) return json(res, 404, { ok: false, erro: 'Serviço não encontrado.' });
      return json(res, 200, { ok: true, servico });
    },
    admin
  );

  router.delete(
    '/api/servicos/:id',
    ({ res, params }) => {
      const removido = repos.excluirServico(Number(params.id));
      if (!removido) return json(res, 404, { ok: false, erro: 'Serviço não encontrado.' });
      return json(res, 200, { ok: true });
    },
    admin
  );

  // --- Agendamentos (CRUD admin) ---

  router.get(
    '/api/agendamentos',
    ({ res, url }) => {
      const status = String(url.searchParams.get('status') || 'todos');
      const de = String(url.searchParams.get('de') || '').trim() || null;
      const ate = String(url.searchParams.get('ate') || '').trim() || null;
      if (status !== 'todos' && !STATUS_AGENDA.has(status)) {
        return json(res, 400, { ok: false, erro: 'Status inválido.' });
      }
      return json(res, 200, { ok: true, agendamentos: repos.listarAgenda({ status, de, ate }) });
    },
    admin
  );

  router.post(
    '/api/agendamentos',
    async ({ req, res }) => {
      const body = await readBody(req);
      if (!String(body.data_hora || '').trim()) {
        return json(res, 400, { ok: false, erro: 'O campo "data_hora" é obrigatório.' });
      }
      const { dados, erro } = sanitizarAgendamento(body);
      if (erro) return json(res, 400, { ok: false, erro });
      if (!dados.status) dados.status = 'livre';
      const result = repos.criarAgendamento({ ...dados, data_hora: dados.data_hora || String(body.data_hora).trim() });
      if (!result.ok) {
        return json(res, 409, {
          ok: false,
          erro: result.motivo === 'horario_ocupado' ? 'Este horário já está ocupado.' : 'Falha ao criar.',
        });
      }
      return json(res, 201, { ok: true, agendamento: repos.getAgendamento(result.id) });
    },
    admin
  );

  router.put(
    '/api/agendamentos/:id',
    async ({ req, res, params }) => {
      const body = await readBody(req);
      const { dados, erro } = sanitizarAgendamento(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const atual = repos.getAgendamento(Number(params.id));
      if (!atual) return json(res, 404, { ok: false, erro: 'Agendamento não encontrado.' });
      const merged = {
        data_hora: dados.data_hora ?? atual.data_hora,
        status: dados.status ?? atual.status,
        cliente_telefone: dados.cliente_telefone ?? atual.cliente_telefone,
        cliente_nome: dados.cliente_nome ?? atual.cliente_nome,
        motivo: dados.motivo ?? atual.motivo,
      };
      const result = repos.atualizarAgendamento({ id: Number(params.id), ...merged });
      if (!result.ok) {
        return json(res, 409, {
          ok: false,
          erro: result.motivo === 'horario_ocupado' ? 'Este horário já está ocupado.' : 'Falha ao atualizar.',
        });
      }
      return json(res, 200, { ok: true, agendamento: repos.getAgendamento(result.id) });
    },
    admin
  );

  router.delete(
    '/api/agendamentos/:id',
    ({ res, params }) => {
      const removido = repos.excluirAgendamento(Number(params.id));
      if (!removido) return json(res, 404, { ok: false, erro: 'Agendamento não encontrado.' });
      return json(res, 200, { ok: true });
    },
    admin
  );
}
