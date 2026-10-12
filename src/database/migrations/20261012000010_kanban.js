import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Kanban" (qualquer tipo de projeto, todos os planos): colunas ordenadas do quadro
// e cartões ordenados dentro de cada coluna. `position` é um inteiro 0..n-1 mantido pela API.
const TABLES = ['kanban_columns', 'kanban_cards'];

export async function up(knex) {
  await knex.schema.createTable('kanban_columns', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 60).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.smallint('wip_limit'); // limite de trabalho em andamento (informativo)
    t.timestamps(true, true);
    t.index(['project_id', 'position']);
  });

  await knex.schema.createTable('kanban_cards', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('column_id').notNullable().references('kanban_columns.id').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.text('description');
    t.integer('position').notNullable().defaultTo(0);
    t.string('priority', 10); // low, medium, high, urgent
    t.date('due_date');
    t.string('assignee', 120);
    t.timestamps(true, true);
    t.index(['column_id', 'position']);
    t.index('project_id');
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
