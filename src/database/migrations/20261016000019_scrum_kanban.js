// Liga as tasks do Scrum ao Kanban: cada task publicada vira um cartão, e as colunas dizem a que
// situação da task correspondem (mover o cartão muda a task, e vice-versa).
export async function up(knex) {
  await knex.schema.alterTable('kanban_columns', (t) => {
    t.string('task_status', 20); // todo, in_progress, done (vazio = coluna sem correspondência)
  });
  await knex.schema.alterTable('kanban_cards', (t) => {
    // o cartão é a projeção da task no quadro: sai junto com ela
    t.uuid('scrum_task_id').unique().references('scrum_tasks.id').onDelete('CASCADE');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('kanban_cards', (t) => {
    t.dropColumn('scrum_task_id');
  });
  await knex.schema.alterTable('kanban_columns', (t) => {
    t.dropColumn('task_status');
  });
}
