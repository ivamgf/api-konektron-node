import { uuidPk } from '../helpers.js';

export async function up(knex) {
  await knex.schema.createTable('refresh_tokens', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('user_id');
  });

  // Ativação de conta (RF1) e recuperação de senha (RF4)
  await knex.schema.createTable('user_tokens', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('type', 'user_token_type').notNullable();
    t.string('token_hash', 64).notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('used_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'type']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('user_tokens');
  await knex.schema.dropTableIfExists('refresh_tokens');
}
