// Resposta às mensagens de contato enviada pela própria plataforma (SMTP do sistema), com o histórico
export async function up(knex) {
  await knex.schema.alterTable('contact_messages', (t) => {
    t.text('reply');
    t.timestamp('replied_at', { useTz: true });
    t.uuid('replied_by').references('users.id').onDelete('SET NULL');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('contact_messages', (t) => {
    t.dropColumn('replied_by');
    t.dropColumn('replied_at');
    t.dropColumn('reply');
  });
}
