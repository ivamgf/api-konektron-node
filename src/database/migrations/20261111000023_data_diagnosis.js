import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Diagnóstico de dados" (qualquer tipo de projeto): inventário preliminar das bases e sistemas,
// relatório de diagnóstico das fontes e fluxos de dados (com a avaliação de maturidade) e plano de
// trabalho para implantação de sistema. Cada documento guarda as seções do modelo em `content` (jsonb),
// validado pelos schemas do módulo (modules/data-diagnosis).
const TABLES = ['dd_inventories', 'dd_reports', 'dd_plans'];

export async function up(knex) {
  for (const table of TABLES) {
    await knex.schema.createTable(table, (t) => {
      uuidPk(knex, t);
      t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
      t.string('title', 200).notNullable();
      t.string('version', 20).notNullable().defaultTo('1.0');
      t.jsonb('content').notNullable().defaultTo('{}');
      t.timestamps(true, true);
      t.index('project_id');
    });
    await addUpdatedAtTrigger(knex, table);
  }
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
