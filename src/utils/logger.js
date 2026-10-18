import pino from 'pino';
import { env } from '#config/env.js';

// pino-pretty é devDependency: na imagem de produção (npm ci --omit=dev) ele não existe,
// então mesmo com NODE_ENV diferente de production o log cai para JSON em vez de derrubar a API.
function hasPrettyTransport() {
  try {
    import.meta.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const usePretty = !env.isProd && hasPrettyTransport();

export const logger = pino({
  level: env.LOG_LEVEL ?? (env.isProd ? 'info' : 'debug'),
  redact: ['req.headers.authorization', '*.password', '*.refreshToken', '*.token'],
  transport: usePretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
