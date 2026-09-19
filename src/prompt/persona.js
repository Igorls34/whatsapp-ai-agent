import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Defaults versionados (mudam por branch: master = identidade pessoal, public = genérica).
const DEFAULT_PATH = path.join(__dirname, 'persona.default.json');

// Personalização feita pelo painel admin. Fica em data/ (fora do versionamento),
// então sobrevive a updates do projeto e nunca é commitada.
const PERSONA_PATH =
  process.env.PERSONA_PATH || path.join(process.cwd(), 'data', 'persona.json');

// Campos de texto que o painel pode editar.
const CAMPOS_TEXTO = [
  'assistente',
  'negocio',
  'responsavel',
  'descricao',
  'tom',
  'saudacao',
  'sempre',
  'nunca',
  'extra',
];

function lerJson(caminho) {
  try {
    const dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    return dados && typeof dados === 'object' ? dados : null;
  } catch {
    return null;
  }
}

// Defaults de fábrica caso o arquivo versionado esteja ausente/corrompido.
const FALLBACK = {
  assistente: 'Assistente Virtual',
  negocio: 'o negócio',
  responsavel: 'o responsável',
  descricao: '',
  tom: 'Calma, acolhedora e amigável. Transmita confiança e paciência, nunca seja seco nem técnico demais.',
  emojis: true,
  saudacao: '',
  sempre: '',
  nunca: '',
  extra: '',
};

export function personaPadrao() {
  return { ...FALLBACK, ...(lerJson(DEFAULT_PATH) || {}) };
}

// Mantém apenas os campos conhecidos e normaliza tipos.
function sanitizar(patch, base) {
  const out = { ...base };
  for (const campo of CAMPOS_TEXTO) {
    if (patch[campo] !== undefined) out[campo] = String(patch[campo]);
  }
  if (patch.emojis !== undefined) {
    out.emojis = !(patch.emojis === false || patch.emojis === 'false' || patch.emojis === 0);
  }
  return out;
}

// Persona efetiva = defaults versionados + personalização salva (se existir).
export function carregarPersona() {
  const base = personaPadrao();
  const override = lerJson(PERSONA_PATH);
  return override ? sanitizar(override, base) : base;
}

export function salvarPersona(patch) {
  const atual = carregarPersona();
  const novo = sanitizar(patch || {}, atual);
  fs.mkdirSync(path.dirname(PERSONA_PATH), { recursive: true });
  fs.writeFileSync(PERSONA_PATH, JSON.stringify(novo, null, 2), 'utf8');
  return novo;
}

// Mescla um patch sobre a persona atual SEM gravar (usado na pré-visualização).
export function montarPersona(patch) {
  return sanitizar(patch || {}, carregarPersona());
}

export function resetarPersona() {
  try {
    fs.rmSync(PERSONA_PATH, { force: true });
  } catch {
    /* ignora */
  }
  return personaPadrao();
}

export function caminhoPersona() {
  return PERSONA_PATH;
}

// Texto de boas-vindas: usa a saudação da persona se definida; senão o padrão
// (ex.: config.welcomes.texto). Assim o painel pode personalizar sem reiniciar.
export function textoBoasVindas(padrao = '') {
  return (carregarPersona().saudacao || '').trim() || padrao;
}

// Converte um texto multilinha em bullets markdown ("- item").
export function comoLista(texto) {
  return String(texto || '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
    .map((l) => `- ${l}`);
}
