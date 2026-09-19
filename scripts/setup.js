#!/usr/bin/env node
// Wizard de configuração plug-and-play:
//  - confere a versão do Node;
//  - instala a CLI do opencode se não estiver disponível;
//  - cria/atualiza o .env com perguntas (identidade, agenda, notificações).
//
// Flags:
//   --yes        usa os padrões sem perguntar (só cria o .env se não existir)
//   --force      recria o .env mesmo se já existir
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { salvarPersona } from '../src/prompt/persona.js';

const NODE_MIN = 20;
const rl = createInterface({ input, output });

async function pergunta(texto, padrao) {
  const resp = (await rl.question(`${texto} ${padrao ? `[${padrao}] ` : ''}`)).trim();
  return resp === '' && padrao !== undefined ? padrao : resp;
}

function fin() {
  try {
    rl.close();
  } catch {}
}

function banner(title) {
  const linha = '='.repeat(title.length + 4);
  console.log(`\n${linha}\n  ${title}\n${linha}\n`);
}

function checarNode() {
  const v = Number(process.versions.node.split('.')[0]);
  if (v < NODE_MIN) {
    console.error(`❌ Node ${process.versions.node} detectado — este projeto precisa do Node ${NODE_MIN}+.`);
    console.error('   Baixe em https://nodejs.org (versão LTS) e rode o setup de novo.');
    process.exit(1);
  }
  return v;
}

function opencodeInstalado() {
  try {
    execSync(process.platform === 'win32' ? 'opencode --version' : 'opencode --version', {
      stdio: 'pipe',
      shell: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function garantirOpencode(auto) {
  if (opencodeInstalado()) {
    console.log('✅ CLI do opencode encontrada globalmente.');
    return;
  }
  console.log('⚠️  CLI do opencode não encontrada.');
  const aceitar = auto ? true : (await pergunta('Instalar agora globalmente com "npm install -g opencode-ai"? [s/N]', 's')).toLowerCase() === 's';
  if (!aceitar) {
    console.warn('   Instale depois com: npm install -g opencode-ai');
    return;
  }
  try {
    console.log('Instalando opencode-ai (isso pode levar alguns minutos)…');
    execSync('npm install -g opencode-ai', { stdio: 'inherit', shell: true });
    console.log(opencodeInstalado() ? '✅ opencode instalado.' : '⚠️  opencode não apareceu no PATH depois da instalação.');
  } catch (err) {
    console.error('❌ Falha ao instalar opencode:', err.message);
  }
}

function lerEnvExample() {
  const caminho = './.env.example';
  if (existsSync(caminho)) return readFileSync(caminho, 'utf8');
  return `# ===== Identidade =====
# A identidade da IA é a "persona" (data/persona.json) — editável na aba "Persona" do painel.
# PERSONA_PATH=./data/persona.json

# ===== WhatsApp =====
WA_SESSION_DIR=./.sessions

# ===== Banco de Dados (SQLite) =====
DB_PATH=./data/agent.db

# ===== IA (opencode local) =====
LLM_BACKEND=local-opencode
OPENCODE_SERVER_URL=http://127.0.0.1:4096
OPENCODE_SERVER_PASSWORD=
# OPENCODE_MODEL=opencode/big-pickle

# ===== Agenda =====
# WORK_SCHEDULE=1-4:12-21,5:10-19,6:8-14
# SCHEDULE_START=7
# SCHEDULE_END=24
SLOT_MINUTES=60
HORIZON_DAYS=14

# ===== Memória =====
KEEP_MESSAGES=12
SUMMARIZE_EVERY=5

# ===== Emergências =====
EMERGENCY_NUMBER=

# ===== Notificações =====
# NOTIF_WHATSAPP=5524999999999
# NOTIF_EMAIL=seu@email.com
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=seu@email.com
# SMTP_PASS=sua-senha-de-app

# ===== Imagens / Boas-vindas =====
# IMAGENS_ATIVO=true
# WELCOME_IMAGE=boasvindas_gif
# WELCOME_TEXT=Olá! Sou o assistente virtual deste negócio. Como posso ajudar?
# WELCOME_INACTIVE_HORAS=24
`;
}

function gerarEnv({ workSchedule, notifWhatsapp, notifEmail, smtpUser }) {
  const env = [];
  env.push('# ===== Identidade =====');
  env.push('# A identidade da IA é a "persona" (data/persona.json), definida no setup e editável na aba "Persona" do painel.');
  env.push('');
  env.push('# ===== WhatsApp =====');
  env.push('WA_SESSION_DIR=./.sessions');
  env.push('');
  env.push('# ===== Banco de Dados (SQLite) =====');
  env.push('DB_PATH=./data/agent.db');
  env.push('');
  env.push('# ===== IA (opencode local) =====');
  env.push('LLM_BACKEND=local-opencode');
  env.push('OPENCODE_SERVER_URL=http://127.0.0.1:4096');
  env.push('OPENCODE_SERVER_PASSWORD=');
  env.push('# OPENCODE_MODEL=opencode/big-pickle');
  env.push('');
  env.push('# ===== Agenda =====');
  env.push(`WORK_SCHEDULE=${workSchedule}`);
  env.push('SCHEDULE_START=7');
  env.push('SCHEDULE_END=24');
  env.push('SLOT_MINUTES=60');
  env.push('HORIZON_DAYS=14');
  env.push('');
  env.push('# ===== Memória =====');
  env.push('KEEP_MESSAGES=12');
  env.push('SUMMARIZE_EVERY=5');
  env.push('');
  env.push('# ===== Emergências (deixe vazio para apenas logar) =====');
  env.push(`EMERGENCY_NUMBER=${process.env.EMERGENCY_NUMBER || ''}`);
  env.push('');
  env.push('# ===== Notificações (deixe vazio para desativar) =====');
  env.push(`NOTIF_WHATSAPP=${notifWhatsapp}`);
  env.push(`NOTIF_EMAIL=${notifEmail}`);
  env.push(`SMTP_HOST=${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
  env.push(`SMTP_PORT=${process.env.SMTP_PORT || '465'}`);
  env.push(`SMTP_SECURE=${process.env.SMTP_SECURE || 'true'}`);
  env.push(`SMTP_USER=${smtpUser}`);
  env.push(`SMTP_PASS=${process.env.SMTP_PASS || ''}`);
  env.push('');
  env.push('# ===== Imagens / Boas-vindas =====');
  env.push('IMAGENS_ATIVO=false');
  env.push('WELCOME_IMAGE=boasvindas_gif');
  env.push('WELCOME_TEXT=Olá! Sou o assistente virtual deste negócio. Como posso ajudar?');
  env.push('WELCOME_INACTIVE_HORAS=24');
  return env.join('\n') + '\n';
}

async function main() {
  banner('⚡ Setup — Assistente Virtual IA local');
  checarNode();

  const flags = { yes: process.argv.includes('--yes'), force: process.argv.includes('--force') };

  if (!flags.yes) await garantirOpencode(false);
  else garantirOpencode(true);

  const envExiste = existsSync('./.env');
  if (envExiste && !flags.force) {
    console.log(flags.yes ? 'ℹ️  .env já existe — mantido (use --force para recriar).' : 'ℹ️  .env já existe. Você pode reconfigurar com --force.');
    if (flags.yes) {
      fin();
      console.log('\n👉 Próximo passo: rode "npm start".\n');
      return;
    }
    const recriar = (await pergunta('Recriar o .env (mantém backups? não — sobrescreve)? [s/N]', 'n')).toLowerCase() === 's';
    if (!recriar) {
      fin();
      console.log('\n👉 Próximo passo: rode "npm start".\n');
      return;
    }
  }

  banner('Identidade do assistente');
  const nome = await pergunta('Nome do negócio/profissional (ex: "Tech Solutions")', 'Assistente Virtual');
  const responsavel = await pergunta('Como o bot deve chamar o humano responsável (ex: "o responsável pelo negócio")', 'o responsável pelo negócio');

  banner('Agenda (horários de trabalho — ficam BLOQUEADOS)');
  console.log('Formato: dias:inicio-fim (0=Dom..6=Sáb, ranges ok, separados por vírgula).');
  const workSchedule = await pergunta('Ex: seg-qui 12-21, sex 10-19, sáb 8-14 → 1-4:12-21,5:10-19,6:8-14', '1-4:12-21,5:10-19,6:8-14');

  banner('Notificações (opcional — pode deixar vazio)');
  const notifWhatsapp = await pergunta('WhatsApp do responsável p/ avisar agendamentos (ex: 5511999999999)', '');
  const notifEmail = await pergunta('Email do responsável p/ avisar agendamentos', '');
  const smtpUser = notifEmail ? await pergunta('Remetente do SMTP (geralmente o mesmo email, com senha de app)', notifEmail) : '';

  const conteudo = gerarEnv({ nome, responsavel, workSchedule, notifWhatsapp, notifEmail, smtpUser });
  writeFileSync('./.env', conteudo, 'utf8');
  console.log('\n✅ .env criado/atualizado.');

  // A identidade da IA agora vem da persona (edite tudo na aba "Persona" do painel).
  try {
    salvarPersona({ negocio: nome, responsavel });
    console.log('✅ Persona criada em data/persona.json (ajuste o resto na aba "Persona" do painel).');
  } catch (err) {
    console.warn('⚠️  Não consegui criar a persona:', err.message);
  }

  fin();
  banner('🎉 Pronto! Para ligar tudo:');
  console.log('   npm start      (sobe a IA + o bot, e reinicia sozinho se cair)');
  console.log('   # 1ª vez: escaneie o QR com o WhatsApp que vai atender.\n');
}

main().catch((err) => {
  fin();
  console.error('❌ Erro no setup:', err.message);
});