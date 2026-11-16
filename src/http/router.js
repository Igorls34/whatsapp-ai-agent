// Router mínimo (sem dependências) usado por todos os servidores HTTP do app.
//
// Rotas são registradas com método + padrão de caminho. Parâmetros dinâmicos
// usam `:nome` (ex.: /api/servicos/:id). Cada rota pode declarar um `guard`
// (ex.: 'admin'), verificado antes do handler — é assim que o token do painel
// protege só as rotas do painel, sem afetar o chat e o healthcheck.
//
// `handle()` devolve true quando alguma rota atendeu o request; false quando
// nenhuma casou (o chamador responde 404).
import { json } from './respond.js';

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compilar(pattern) {
  if (pattern === '/') return { regex: /^\/$/, chaves: [] };
  const partes = pattern.split('/').filter(Boolean);
  const regex = new RegExp(
    '^/' +
      partes
        .map((parte) => {
          if (parte.startsWith(':')) return '([^/]+)';
          return escaparRegex(parte);
        })
        .join('/') +
      '/?$'
  );
  const chaves = partes.filter((p) => p.startsWith(':')).map((p) => p.slice(1));
  return { regex, chaves };
}

export function createRouter({ guards = {} } = {}) {
  const rotas = [];

  function add(method, pattern, handler, { guard = null } = {}) {
    const { regex, chaves } = compilar(pattern);
    rotas.push({ method: method.toUpperCase(), regex, chaves, handler, guard });
    return api;
  }

  const api = {
    add,
    get: (pattern, handler, opts) => add('GET', pattern, handler, opts),
    post: (pattern, handler, opts) => add('POST', pattern, handler, opts),
    put: (pattern, handler, opts) => add('PUT', pattern, handler, opts),
    delete: (pattern, handler, opts) => add('DELETE', pattern, handler, opts),

    async handle(req, res, ctx = {}) {
      const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      for (const rota of rotas) {
        if (rota.method !== req.method) continue;
        const match = rota.regex.exec(url.pathname);
        if (!match) continue;

        if (rota.guard) {
          const permitir = guards[rota.guard];
          if (typeof permitir !== 'function' || !permitir(req)) {
            json(res, 401, { ok: false, erro: 'Não autorizado. Token inválido.' });
            return true;
          }
        }

        const params = {};
        rota.chaves.forEach((chave, i) => {
          params[chave] = decodeURIComponent(match[i + 1]);
        });

        await rota.handler({ req, res, url, params, ...ctx });
        return true;
      }
      return false;
    },
  };

  return api;
}
