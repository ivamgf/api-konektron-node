import { app } from './app.js';
import { env } from '#config/env.js';
import { db } from '#database/connection.js';
import { logger } from '#utils/logger.js';
import { billingService } from '#modules/billing/billing.service.js';
import { projectsService } from '#modules/projects/projects.service.js';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 KonekTron API em ${env.API_URL}/api/v1 (${env.NODE_ENV}, Node ${process.version})`);
});

// A cada hora: assinaturas em atraso ou com o período pago encerrado atualizam o plano, e os projetos do
// Free sem uso há 3 meses são excluídos
async function maintenance() {
  try {
    await billingService.expireAccess();
  } catch (err) {
    logger.error({ err }, 'Falha ao conferir as assinaturas');
  }
  try {
    await projectsService.purgeInactive();
  } catch (err) {
    logger.error({ err }, 'Falha ao excluir os projetos sem uso do Free');
  }
}
setTimeout(maintenance, 60_000).unref();
setInterval(maintenance, 3_600_000).unref();

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
