import knex from 'knex';
import pg from 'pg';
import config from '../../knexfile.js';
import { env } from '#config/env.js';
import { postProcessResponse, wrapIdentifier } from '#utils/case.js';

// bigint (int8) e numeric chegam como string no driver pg; convertemos para number.
// Seguro para contagens/tamanhos até 2^53 e para os decimais de métricas.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));
// date sem hora fica como 'YYYY-MM-DD': virar Date (meia-noite local) desloca o dia ao serializar em UTC
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

// Na aplicação usamos camelCase; o banco continua em snake_case.
// (Os hooks não são aplicados no CLI de migrations, que trabalha direto em snake_case.)
export const db = knex({
  ...(config[env.NODE_ENV] ?? config.development),
  postProcessResponse,
  wrapIdentifier,
});
