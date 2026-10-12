// Testa a conexão com o banco configurado no .env: npm run db:check
// Mostra o destino (sem a senha), a versão do PostgreSQL e as migrations aplicadas.
import knex from 'knex';
import config from '../knexfile.js';

const env = process.env.NODE_ENV ?? 'development';
const settings = config[env] ?? config.development;

function describe(connection) {
  if (connection.connectionString) {
    const url = new URL(connection.connectionString);
    return `${url.username}@${url.hostname}:${url.port || 5432}${url.pathname}`;
  }
  return `${connection.user}@${connection.host}:${connection.port}/${connection.database}`;
}

const db = knex({ ...settings, pool: { min: 0, max: 1 }, acquireConnectionTimeout: 10_000 });
console.log(`Conectando em ${describe(settings.connection)} (${env})...`);

try {
  const { rows } = await db.raw(
    'select version() as version, current_database() as database, current_user as "user"',
  );
  console.log(`✔ Conectado: ${rows[0].database} como ${rows[0].user}`);
  console.log(`  ${rows[0].version}`);

  const [done, pending] = await db.migrate.list();
  console.log(`  Migrations aplicadas: ${done.length} · pendentes: ${pending.length}`);
  if (pending.length) console.log('  Rode "npm run migrate" para criar as tabelas.');

  const citext = await db.raw(`select 1 from pg_available_extensions where name = 'citext'`);
  if (!citext.rows.length) console.log('  ⚠ Extensão citext indisponível: as migrations vão falhar.');
} catch (err) {
  console.error(`✖ Falha na conexão: ${err.code ?? ''} ${err.message}`);
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(err.code)) {
    console.error('  O host não foi encontrado. Nomes internos do painel só existem dentro do servidor;');
    console.error('  de fora, use um túnel SSH ou a porta pública do banco (ver README, "Banco na HostGator").');
  }
  if (err.code === 'ECONNREFUSED') {
    console.error('  Nada respondeu nessa porta: o túnel SSH está aberto? A porta pública está liberada?');
  }
  if (err.code === '28P01') console.error('  Usuário ou senha recusados pelo banco.');
  if (err.code === '3D000') console.error('  O banco informado não existe nesse servidor.');
  process.exitCode = 1;
} finally {
  await db.destroy();
}
