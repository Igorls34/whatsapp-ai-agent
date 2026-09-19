import 'dotenv/config';

function parseHours(value) {
  const [start, end] = String(value).split('-').map((n) => parseInt(n, 10));
  return { start, end };
}

// Formato: "dias:inicio-fim,dias:inicio-fim"
// Ex: "1-4:12-21,5:10-19,6:8-14"  (seg-sex com horários distintos, sáb separado)
// Dias: 0=Dom, 1=Seg ... 6=Sáb. Ranges aceitos (1-4 = seg a qui).
function parseWorkSchedule(value) {
  const workBlocked = {}; // { 1: [{start:12,end:21}], 5: [{start:10,end:19}] }
  if (!value) return workBlocked;

  for (const parte of String(value).split(',')) {
    const [diasStr, horariosStr] = parte.trim().split(':');
    if (!diasStr || !horariosStr) continue;

    const [hStart, hEnd] = horariosStr.split('-').map((n) => parseInt(n, 10));

    // Expande range de dias (ex: "1-4" → [1,2,3,4])
    const dias = [];
    if (diasStr.includes('-')) {
      const [a, b] = diasStr.split('-').map((n) => parseInt(n, 10));
      for (let d = a; d <= b; d++) dias.push(d);
    } else {
      dias.push(parseInt(diasStr, 10));
    }

    for (const d of dias) {
      if (!workBlocked[d]) workBlocked[d] = [];
      workBlocked[d].push({ start: hStart, end: hEnd });
    }
  }

  return workBlocked;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',

  // Identidade (template genérico — personalize via .env)
  negocio: {
    // Nome do negócio/profissional (personalize via NEGOCIO_NOME)
    nome: process.env.NEGOCIO_NOME || 'Assistente Virtual',
    // Como o modelo chama o humano responsável pelo negócio
    responsavel: process.env.NEGOCIO_RESPONSAVEL || 'o responsável pelo negócio',
  },

  // WhatsApp
  waSessionDir: process.env.WA_SESSION_DIR || './.sessions',

  // Banco
  dbPath: process.env.DB_PATH || './data/agent.db',

  // Emergências
  emergencyNumber: process.env.EMERGENCY_NUMBER || '',

  // Notificações (agendamentos) — WhatsApp e email do responsável
  notificacoes: {
    whatsapp: process.env.NOTIF_WHATSAPP || '',
    email: process.env.NOTIF_EMAIL || '',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: (process.env.SMTP_SECURE || 'true') === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },

  // LLM (IA do próprio opencode, via opencode serve local)
  llm: {
    // 'local-opencode' (opencode serve na sua máquina) | 'openai-compatible' (futuro: aponta pro Zen ou outro)
    backend: process.env.LLM_BACKEND || 'local-opencode',

    opencode: {
      url: process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096',
      password: process.env.OPENCODE_SERVER_PASSWORD || '',
      username: process.env.OPENCODE_SERVER_USERNAME || 'opencode',
      model: process.env.OPENCODE_MODEL || undefined, // ex: 'opencode/big-pickle' (default do server se vazio)
    },

    // Usado apenas se LLM_BACKEND=openai-compatible (ex: endpoint Zen https://opencode.ai/zen/v1)
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      summaryModel: process.env.OPENAI_SUMMARY_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
  },

  // Agenda
  agenda: {
    // Horários de TRABALHO (bloqueados para agendamento).
    // Formato: "dias:inicio-fim,dias:inicio-fim" (dias: 0=Dom..6=Sáb)
    // Ex: "1-4:12-21,5:10-19,6:8-14"
    workBlocked: parseWorkSchedule(process.env.WORK_SCHEDULE || '1-4:12-21,5:10-19,6:8-14'),
    // Janela mínima/máxima do dia em que slots podem existir (fora do trabalho)
    scheduleStart: Number(process.env.SCHEDULE_START || 7),
    scheduleEnd: Number(process.env.SCHEDULE_END || 24),
    slotMinutes: Number(process.env.SLOT_MINUTES || 60),
    horizonDays: Number(process.env.HORIZON_DAYS || 14),
  },

  // Memória de conversa
  memory: {
    keepMessages: Number(process.env.KEEP_MESSAGES || 12),
    summarizeEvery: Number(process.env.SUMMARIZE_EVERY || 5),
  },

  // Imagens que o bot pode enviar ao cliente (catálogo via manifest).
  // Desativado por padrão; reative com IMAGENS_ATIVO=true.
  imagens: {
    ativo: (process.env.IMAGENS_ATIVO || 'false') === 'true',
    dir: process.env.IMAGENS_DIR || './assets/imagens',
  },

  // Boas-vindas
  welcomes: {
    // Apelido da imagem/gif no manifest (ex: boasvindas_gif). Só usado se imagens.ativo
    imagem: process.env.WELCOME_IMAGE || 'boasvindas_gif',
    // Texto de apresentação (usado como legenda da imagem)
    texto:
      process.env.WELCOME_TEXT ||
      'Olá! 😊 Eu sou o assistente virtual deste negócio. Posso apresentar os serviços, tirar dúvidas e ajudar a agendar um atendimento. Como posso te ajudar?',
    // Cliente que não interage há esse tempo (horas) recebe boas-vindas de novo
    inativoHoras: Number(process.env.WELCOME_INACTIVE_HORAS || 24),
  },

  // Painel admin (CRUD de serviços) — servidor HTTP simples local
  admin: {
    port: Number(process.env.ADMIN_PORT || 3000),
    // Se preenchido, o painel exige autenticação (token): envie "Authorization: Bearer TOKEN"
    token: process.env.ADMIN_TOKEN || '',
  },

  // Chat web (portfólio): página + API para conversar com o mesmo agente
  web: {
    host: process.env.WEB_HOST || '127.0.0.1',
    port: Number(process.env.WEB_PORT || 4000),
  },

  // Controle de gargalos (backpressure)
  limites: {
    // Quantas respostas de IA podem rodar em paralelo no mesmo processo
    llmMaxConcurrent: Number(process.env.LLM_MAX_CONCURRENT || 3),
    // Tempo máximo de um turno de IA antes de ser cancelado (ms)
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 60000),
    // Intervalo mínimo entre envios no WhatsApp (ms)
    envioMinGapMs: Number(process.env.ENVIO_MIN_GAP_MS || 700),
    // Respostas simultâneas máximas atendidas pelo chat web
    webMaxConcurrent: Number(process.env.WEB_MAX_CONCURRENT || 3),
    // Tempo máximo de um request do chat web antes de responder 503 (ms)
    webTimeoutMs: Number(process.env.WEB_TIMEOUT_MS || 60000),
  },
};