import { z } from 'zod';

try {
  process.loadEnvFile(); // Node 24: dispensa o pacote dotenv
} catch {
  // sem .env: usa as variáveis do ambiente
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'homologation', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  APP_URL: z.url(),
  API_URL: z.url(),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_ACCESS_SECRET: z.string().min(32, { error: 'precisa ter ao menos 32 caracteres' }),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.enum(['true', 'false']).default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  CORS_ORIGINS: z.string().default(''),
  DOCS_ENABLED: z.enum(['true', 'false']).default('true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

const data = parsed.data;

export const env = Object.freeze({
  ...data,
  isProd: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  corsOrigins: data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
});
