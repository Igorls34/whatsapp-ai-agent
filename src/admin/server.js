import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db/database.js';
import { createRepositories } from '../db/repositories.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, 'index.html');
const VENDOR_DIR = path.join(__dirname, 'vendor');
const HOST = '127.0.0.1';
const PORT = config.admin.port;
const TOKEN = config.admin.token;

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const db = openDatabase();
const repos = createRepositories(db);

const html = fs.readFileSync(HTML_PATH, 'utf8');

function text(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function autorizado(req) {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function sanitizarServico(body) {
  const nome = String(body.nome || '').trim();
  if (!nome) return { erro: 'O campo "nome" é obrigatório.' };
  const descricao = String(body.descricao || '').trim();
  const categoria = String(body.categoria || '').trim();
  const ordem = Number.parseInt(body.ordem, 10);
  const ativo = [true, 1, '1', 'true', 'on'].includes(body.ativo) ? 1 : 0;
  return { dados: { nome, descricao, categoria, ordem: Number.isNaN(ordem) ? 0 : ordem, ativo } };
}

const STATUS_AGENDA = new Set(['livre', 'agendado', 'confirmada', 'cancelada']);

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (!autorizado(req)) {
    return json(res, 401, { ok: false, erro: 'Não autorizado. Token inválido.' });
  }

  try {
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    // Assets locais (Bootstrap) — painel 100% offline
    if (req.method === 'GET' && pathname.startsWith('/vendor/')) {
      const rel = pathname.replace(/^\/vendor\//, '');
      const filePath = path.normalize(path.join(VENDOR_DIR, rel));
      if (!filePath.startsWith(VENDOR_DIR) || path.basename(filePath) !== rel.split('/').pop()) {
        return json(res, 403, { ok: false, erro: 'Acesso negado.' });
      }
      if (!fs.existsSync(filePath)) return json(res, 404, { ok: false, erro: 'Não encontrado.' });
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(filePath));
    }

    // GET /api/dashboard — resumo para a mini-gestão
    if (req.method === 'GET' && pathname === '/api/dashboard') {
      return json(res, 200, { ok: true, painel: repos.obterResumoPainel() });
    }

    // GET /api/clientes?q=
    if (req.method === 'GET' && pathname === '/api/clientes') {
      const q = String(url.searchParams.get('q') || '');
      return json(res, 200, { ok: true, clientes: repos.listarClientes({ q, limite: 200 }) });
    }

    // PUT /api/clientes/:telefone — reabre o chat (desbloqueia)
    const matchCli = pathname.match(/^\/api\/clientes\/([^/]+)$/);
    if (req.method === 'PUT' && matchCli) {
      const telefone = decodeURIComponent(matchCli[1]);
      const resultado = repos.atenderCliente(telefone);
      if (!resultado.ok) return json(res, 409, { ok: false, erro: 'O chat já está liberado.' });
      return json(res, 200, { ok: true, cliente: repos.getCliente(telefone) });
    }

    // GET /api/servicos
    if (req.method === 'GET' && pathname === '/api/servicos') {
      return json(res, 200, { ok: true, servicos: repos.listarServicosAdmin() });
    }

    // GET /api/categorias (sugestões para o formulário)
    if (req.method === 'GET' && pathname === '/api/categorias') {
      return json(res, 200, { ok: true, categorias: repos.listarCategorias() });
    }

    // POST /api/servicos
    if (req.method === 'POST' && pathname === '/api/servicos') {
      const body = await readBody(req);
      const { dados, erro } = sanitizarServico(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const servico = repos.criarServico(dados);
      return json(res, 201, { ok: true, servico });
    }

    // PUT /api/servicos/:id
    const match = pathname.match(/^\/api\/servicos\/(\d+)$/);
    if (req.method === 'PUT' && match) {
      const body = await readBody(req);
      const { dados, erro } = sanitizarServico(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const servico = repos.atualizarServico({ id: Number(match[1]), ...dados });
      if (!servico) return json(res, 404, { ok: false, erro: 'Serviço não encontrado.' });
      return json(res, 200, { ok: true, servico });
    }

    // DELETE /api/servicos/:id
    if (req.method === 'DELETE' && match) {
      const removido = repos.excluirServico(Number(match[1]));
      if (!removido) return json(res, 404, { ok: false, erro: 'Serviço não encontrado.' });
      return json(res, 200, { ok: true });
    }

    // --- Agendamentos (CRUD admin) ---

    // GET /api/agendamentos?status=&de=&ate=
    if (req.method === 'GET' && pathname === '/api/agendamentos') {
      const status = String(url.searchParams.get('status') || 'todos');
      const de = String(url.searchParams.get('de') || '').trim() || null;
      const ate = String(url.searchParams.get('ate') || '').trim() || null;
      if (status !== 'todos' && !STATUS_AGENDA.has(status)) {
        return json(res, 400, { ok: false, erro: 'Status inválido.' });
      }
      return json(res, 200, { ok: true, agendamentos: repos.listarAgenda({ status, de, ate }) });
    }

    // POST /api/agendamentos
    if (req.method === 'POST' && pathname === '/api/agendamentos') {
      const body = await readBody(req);
      if (!String(body.data_hora || '').trim()) {
        return json(res, 400, { ok: false, erro: 'O campo "data_hora" é obrigatório.' });
      }
      const { dados, erro } = sanitizarAgendamento(body);
      if (erro) return json(res, 400, { ok: false, erro });
      if (!dados.status) dados.status = 'livre';
      const result = repos.criarAgendamento({ ...dados, data_hora: dados.data_hora || String(body.data_hora).trim() });
      if (!result.ok) return json(res, 409, { ok: false, erro: result.motivo === 'horario_ocupado' ? 'Este horário já está ocupado.' : 'Falha ao criar.' });
      return json(res, 201, { ok: true, agendamento: repos.getAgendamento(result.id) });
    }

    // PUT /api/agendamentos/:id
    const matchAg = pathname.match(/^\/api\/agendamentos\/(\d+)$/);
    if (req.method === 'PUT' && matchAg) {
      const body = await readBody(req);
      const { dados, erro } = sanitizarAgendamento(body);
      if (erro) return json(res, 400, { ok: false, erro });
      const atual = repos.getAgendamento(Number(matchAg[1]));
      if (!atual) return json(res, 404, { ok: false, erro: 'Agendamento não encontrado.' });
      const merged = {
        data_hora: dados.data_hora ?? atual.data_hora,
        status: dados.status ?? atual.status,
        cliente_telefone: dados.cliente_telefone ?? atual.cliente_telefone,
        cliente_nome: dados.cliente_nome ?? atual.cliente_nome,
        motivo: dados.motivo ?? atual.motivo,
      };
      const result = repos.atualizarAgendamento({ id: Number(matchAg[1]), ...merged });
      if (!result.ok) return json(res, 409, { ok: false, erro: result.motivo === 'horario_ocupado' ? 'Este horário já está ocupado.' : 'Falha ao atualizar.' });
      return json(res, 200, { ok: true, agendamento: repos.getAgendamento(result.id) });
    }

    // DELETE /api/agendamentos/:id
    if (req.method === 'DELETE' && matchAg) {
      const removido = repos.excluirAgendamento(Number(matchAg[1]));
      if (!removido) return json(res, 404, { ok: false, erro: 'Agendamento não encontrado.' });
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { ok: false, erro: 'Rota não encontrada.' });
  } catch (err) {
    console.error('[admin] erro:', err);
    return json(res, 500, { ok: false, erro: 'Erro interno do servidor.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[admin] Painel de controle em http://${HOST}:${PORT}`);
  console.log(`[admin] Autenticação: ${TOKEN ? 'Bearer token ativo' : 'desativada (acesso local)'}`);
});