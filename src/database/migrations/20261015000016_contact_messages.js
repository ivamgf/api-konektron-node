import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Mensagens do formulário de contato (página Contatos); o admin acompanha pela administração
export async function up(knex) {
  await knex.schema.createTable('contact_messages', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').references('users.id').onDelete('SET NULL'); // quando enviada logado
    t.string('name', 120).notNullable();
    t.string('email', 254).notNullable();
    t.string('subject', 150).notNullable();
    t.text('message').notNullable();
    t.string('status', 20).notNullable().defaultTo('new'); // new, read, answered, archived
    t.string('ip', 64);
    t.string('user_agent', 500);
    t.timestamps(true, true);
    t.index(['status', 'created_at']);
  });
  await addUpdatedAtTrigger(knex, 'contact_messages');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('contact_messages');
}
