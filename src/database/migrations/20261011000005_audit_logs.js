export async function up(knex) {
  await knex.schema.createTable('audit_logs', (t) => {
    t.bigIncrements('id').primary();
    t.uuid('user_id').references('users.id').onDelete('SET NULL');
    t.string('action', 100).notNullable(); // auth.login, admin.user_delete...
    t.text('description');
    t.specificType('ip', 'inet');
    t.string('user_agent', 500);
    t.string('request_id', 100);
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id', 'created_at']);
    t.index(['action', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
}
