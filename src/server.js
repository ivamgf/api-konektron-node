import { app } from './app.js';
import { env } from '#config/env.js';
import { db } from '#database/connection.js';
import { logger } from '#utils/logger.js';
import { billingService } from '#modules/billing/billing.service.js';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 KonekTron API em ${env.API_URL}/api/v1 (${env.NODE_ENV}, Node ${process.version})`);
});

// Assinaturas canceladas: devolve ao Free quem chegou ao fim do período pago (a cada hora)
const expireAccess = () =>
  billingService.expireAccess().catch((err) => logger.error({ err }, 'Falha ao encerrar acessos de assinaturas canceladas'));
setTimeout(expireAccess, 60_000).unref();
setInterval(expireAccess, 3_600_000).unref();

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  logger.info(`${signal} recebido, encerrando...`);
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // não fica preso em conexões abertas
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandledRejection'));
