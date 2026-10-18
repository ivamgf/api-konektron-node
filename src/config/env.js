import { z } from 'zod';

try {
  process.loadEnvFile(); // Node 24: dispensa o pacote dotenv
} catch {
  // sem .env: usa as variáveis do ambiente
}

const optionalText = z.string().trim().min(1).optional();

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'homologation', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().default(3333),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
    APP_URL: z.url(),
    API_URL: z.url(),
    // Banco: DATABASE_URL ou o conjunto DB_* (ver knexfile.js)
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, {
        error: 'use o formato postgres://usuario:senha@host:porta/banco',
      })
      .optional(),
    DB_HOST: optionalText,
    DB_PORT: z.coerce.number().int().default(5432),
    DB_NAME: optionalText,
    DB_USER: optionalText,
    DB_PASSWORD: z.string().optional(),
    DB_SSL: z.enum(['true', 'false']).default('false'),
    JWT_ACCESS_SECRET: z.string().min(32, { error: 'precisa ter ao menos 32 caracteres' }),
    JWT_ACCESS_EXPIRES: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
    // Login com Google: ID do cliente OAuth (Web). Vazio desliga o POST /auth/google.
    GOOGLE_CLIENT_ID: z.preprocess(
      (v) => (typeof v === 'string' && !v.trim() ? undefined : v),
      z
        .string()
        .trim()
        .regex(/\.apps\.googleusercontent\.com$/, { error: 'use o ID do cliente OAuth (...apps.googleusercontent.com)' })
        .optional(),
    ),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_SECURE: z.enum(['true', 'false']).default('true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    // destino das mensagens do formulário de contato (vazio: as mensagens só ficam no banco)
    CONTACT_EMAIL: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? undefined : v), z.email().optional()),
    CORS_ORIGINS: z.string().default(''),
    DOCS_ENABLED: z.enum(['true', 'false']).default('true'),
  })
  .refine((e) => e.DATABASE_URL || (e.DB_HOST && e.DB_NAME && e.DB_USER), {
    error: 'defina DATABASE_URL ou DB_HOST, DB_NAME e DB_USER',
    path: ['DATABASE_URL'],
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
  corsOrigins: data.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});
