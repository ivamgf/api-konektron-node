import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Pontos de Função" (projetos `software`, plano Master): contagens IFPUG com as funções de
// dados (ALI/AIE) e de transação (EE/SE/CE); complexidade e PF são calculados e gravados pela API.
const TABLES = ['fp_counts', 'fp_functions'];

export async function up(knex) {
  await knex.schema.createTable('fp_counts', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('count_type', 20).notNullable(); // development, enhancement, application
    t.text('purpose');
    t.text('scope'); // escopo e fronteira da aplicação
    t.string('counter', 200);
    t.date('counted_at');
    t.decimal('hours_per_fp', 10, 2);
    t.decimal('cost_per_hour', 12, 2);
    t.string('currency', 3).notNullable().defaultTo('BRL');
    t.text('notes');
    t.timestamps(true, true);
    t.index('project_id');
  });

  await knex.schema.createTable('fp_functions', (t) => {
    uuidPk(knex, t);
    t.uuid('count_id').notNullable().references('fp_counts.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('type', 5).notNullable(); // ilf, eif, ei, eo, eq
    t.integer('det').notNullable(); // TD
    t.integer('ret_ftr').notNullable(); // TR (dados) ou ALR (transações)
    t.string('complexity', 10).notNullable(); // low, average, high
    t.smallint('points').notNullable();
    t.string('action', 10); // add, change, delete (melhoria)
    t.text('description');
    t.timestamps(true, true);
    t.index(['count_id', 'type']);
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
