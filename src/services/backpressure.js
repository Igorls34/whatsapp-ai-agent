// Utilidades de controle de gargalo:
//  - createSemaphore(max): limita quantas operações (ex.: turnos de LLM) rodam
//    em paralelo; o excesso espera na fila (FIFO).
//  - createSendPacer({ minGapMs }): serializa envios (ex.: sendMessage do
//    WhatsApp) impondo um intervalo mínimo entre cada um, evitando rajadas que
//    o transporte pode derrubar ou filtrar.
//  - withTimeout(promise, ms): resolve não além de `ms` (AbortSignal.timeout);
//    ideal para requests de IA que podem travar.

export function createSemaphore(max) {
  if (!(max > 0)) max = 1;
  let ativos = 0;
  const fila = [];

  function agendar() {
    if (ativos >= max || fila.length === 0) return;
    const next = fila.shift();
    ativos += 1;
    next();
  }

  async function run(fn) {
    await new Promise((resolve) => {
      fila.push(resolve);
      agendar();
    });
    try {
      return await fn();
    } finally {
      ativos -= 1;
      agendar(); // libera o próximo da fila
    }
  }

  return {
    run,
    get ativos() {
      return ativos;
    },
    get tamanhoFila() {
      return fila.length;
    },
  };
}

export function createSendPacer({ minGapMs = 700 } = {}) {
  let lastSent = 0;
  let encadeado = Promise.resolve();

  async function run(fn) {
    const enviar = async () => {
      const espera = (lastSent + minGapMs) - Date.now();
      if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
      lastSent = Date.now();
      return fn();
    };
    const prox = encadeado.then(enviar, enviar);
    // encadeado nunca "quebra": erros do envio são propagados a quem chamou.
    encadeado = prox.catch(() => {});
    return prox;
  }

  return { run };
}

export function withTimeout(fn, ms, label = 'operação') {
  return (...args) =>
    new Promise((resolve, reject) => {
      const guard = setTimeout(() => reject(new Error(`${label} excedeu o tempo limite de ${ms}ms`)), ms);
      Promise.resolve()
        .then(() => fn(...args))
        .then((v) => { clearTimeout(guard); resolve(v); })
        .catch((err) => { clearTimeout(guard); reject(err); });
    });
}