import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../db/database.js';
import { createRepositories } from '../db/repositories.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, 'index.html');
const HOST = '127.0.0.1';
const PORT = config.admin.port;
const TOKEN = config.admin.token;

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (!autorizado(req)) {
    return json(res, 401, { ok: false, erro: 'Não autorizado. Token inválido.' });
  }

  try {
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
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

    return json(res, 404, { ok: false, erro: 'Rota não encontrada.' });
  } catch (err) {
    console.error('[admin] erro:', err);
    return json(res, 500, { ok: false, erro: 'Erro interno do servidor.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[admin] Painel de serviços em http://${HOST}:${PORT}`);
  console.log(`[admin] Autenticação: ${TOKEN ? 'Bearer token ativo' : 'desativada (acesso local)'}`);
});