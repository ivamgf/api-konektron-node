// Node 24: leitura nativa do .env (sem dotenv)
try {
  process.loadEnvFile();
} catch {
  // sem .env: usa as variáveis já definidas no ambiente (ex.: PM2, CI)
}

// DATABASE_URL (formato dos painéis de hospedagem) tem prioridade sobre as variáveis DB_*.
// Com URL, o SSL é definido nela: ?sslmode=disable | require.
const connection = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const base = {
  client: 'pg',
  connection,
  pool: { min: 0, max: 10 },
  migrations: { directory: './src/database/migrations', tableName: 'knex_migrations' },
  seeds: { directory: './src/database/seeds' },
};

export default {
  development: base,
  test: base,
  homologation: base,
  production: { ...base, pool: { min: 2, max: 20 } },
};
