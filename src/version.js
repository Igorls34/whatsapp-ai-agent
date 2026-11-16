// Identidade da versão que está RODANDO (não a do git working tree).
//
// Serve para o /health e para o deploy provarem o que subiu: o deploy.sh compara
// a versão do checkout com a que o processo em execução reporta. O commit é
// opcional (`APP_COMMIT`, exportado pelo deploy via systemd) — a versão sozinha
// já muda a cada release.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let cache = null;

export function versaoApp() {
  if (cache) return cache;

  let versao = 'desconhecida';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
    if (pkg.version) versao = String(pkg.version);
  } catch {
    /* sem package.json legível: segue como desconhecida */
  }

  const commit = String(process.env.APP_COMMIT || process.env.GIT_COMMIT || '').trim() || null;
  cache = { versao, commit };
  return cache;
}
