import { createUpdatedAtFunction } from '../helpers.js';

// gen_random_uuid() é nativo desde o PostgreSQL 13 (não precisa de pgcrypto)
export async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS citext'); // e-mail case-insensitive
  await createUpdatedAtFunction(knex);
  await knex.raw(`CREATE TYPE user_role AS ENUM ('client', 'admin', 'provider')`);
  await knex.raw(`CREATE TYPE user_plan AS ENUM ('free', 'standard', 'master')`);
  await knex.raw(`CREATE TYPE user_token_type AS ENUM ('email_verification', 'password_reset')`);
  await knex.raw(`CREATE TYPE project_type AS ENUM ('software', 'data_analysis')`);
}

export async function down(knex) {
  for (const t of ['project_type', 'user_token_type', 'user_plan', 'user_role']) {
    await knex.raw(`DROP TYPE IF EXISTS ${t}`);
  }
  await knex.raw('DROP FUNCTION IF EXISTS set_updated_at()');
}
