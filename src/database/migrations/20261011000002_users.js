import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Substitui `users`, `admin`, `providers` e `authorization` do schema MySQL antigo
export async function up(knex) {
  await knex.schema.createTable('users', (t) => {
    uuidPk(knex, t);
    t.specificType('email', 'citext').notNullable().unique();
    t.string('password_hash', 255); // nulo em contas só Google
    t.specificType('role', 'user_role').notNullable().defaultTo('client');
    t.specificType('plan', 'user_plan').notNullable().defaultTo('free');
    t.string('google_id', 255).unique();
    t.boolean('terms_accepted').notNullable().defaultTo(false);
    t.timestamp('email_verified_at', { useTz: true });
    t.timestamp('last_login_at', { useTz: true });
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.timestamp('deleted_at', { useTz: true });
  });
  await addUpdatedAtTrigger(knex, 'users');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
