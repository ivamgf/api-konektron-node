import pino from 'pino';
import { env } from '#config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.isProd ? 'info' : 'debug'),
  redact: ['req.headers.authorization', '*.password', '*.refreshToken', '*.token'],
  transport: env.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
