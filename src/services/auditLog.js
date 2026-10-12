import { db } from '#database/connection.js';
import { logger } from '#utils/logger.js';

// RF1/RF2/RF5: log de acesso e operações. Nunca derruba a requisição.
export async function audit({ userId = null, action, description = null, req }) {
  try {
    await db('audit_logs').insert({
      userId,
      action,
      description,
      ip: req?.ip ?? null,
      userAgent: req?.get?.('user-agent')?.slice(0, 500) ?? null,
      requestId: req?.id ?? null,
    });
  } catch (err) {
    logger.error({ err }, 'Falha ao gravar audit log');
  }
}
