// Ponto de entrada do sistema: sobe TUDO em um único processo — WhatsApp,
// painel (/admin), chat web (/), pareamento (/qr) e healthcheck (/health).
// O opcode serve (:4096) continua sendo um processo externo (o "cérebro").
import { criarAplicacao } from './app.js';

export async function main() {
  const app = criarAplicacao();

  const encerrar = async (sinal) => {
    console.log(`[app] encerrando (${sinal})…`);
    try {
      await app.parar();
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => encerrar('SIGINT'));
  process.once('SIGTERM', () => encerrar('SIGTERM'));

  await app.iniciar();
  return app;
}

main().catch((err) => {
  console.error('[app] falha ao iniciar:', err);
  process.exit(1);
});
