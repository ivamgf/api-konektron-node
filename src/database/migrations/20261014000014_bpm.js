import { addUpdatedAtTrigger, fileBlobTable, fileColumns, uuidPk } from '../helpers.js';

// Seção "BPM" (qualquer tipo de projeto, planos Standard/Master): arquitetura de processos
// (macroprocesso → atividade) com SIPOC e diagnóstico, e diagramas BPMN com o arquivo anexado.
const TABLES = ['bpm_processes', 'bpm_diagrams'];

export async function up(knex) {
  await knex.schema.createTable('bpm_processes', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('parent_id').references('bpm_processes.id').onDelete('SET NULL');
    t.string('code', 20).notNullable(); // MP1, P1.2...
    t.string('name', 200).notNullable();
    t.string('level', 20).notNullable(); // macroprocess, process, subprocess, activity
    t.string('status', 20).notNullable().defaultTo('identified');
    t.string('owner', 200);
    t.text('objective');
    t.text('description');
    t.text('trigger');
    // SIPOC: um item por linha
    t.text('suppliers');
    t.text('inputs');
    t.text('steps');
    t.text('outputs');
    t.text('customers');
    // diagnóstico
    t.text('indicators');
    t.text('problems');
    t.text('improvements');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
    t.index('parent_id');
  });

  await knex.schema.createTable('bpm_diagrams', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('process_id').references('bpm_processes.id').onDelete('SET NULL');
    t.string('title', 200).notNullable();
    t.string('state', 10).notNullable().defaultTo('as_is'); // as_is, to_be
    t.string('notation', 10); // bpmn, image, pdf, other
    t.string('version', 20);
    t.string('tool', 100);
    t.text('description');
    t.string('url', 1000);
    t.jsonb('metrics'); // leitura do BPMN: tarefas, eventos, gateways, raias...
    fileColumns(t);
    t.timestamps(true, true);
    t.index(['project_id', 'process_id']);
  });
  await fileBlobTable(knex, 'bpm_diagram_files', 'diagram_id', 'bpm_diagrams.id');

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('bpm_diagram_files');
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
