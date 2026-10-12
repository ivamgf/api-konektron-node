import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Análise de Sistemas" (projetos `software`). Substitui `analysis`, `requirements`,
// `user_stories`, `diagrams` e as tabelas `*_have_*` do schema MySQL antigo: os artefatos
// passam a pertencer diretamente ao projeto (project_id), sem tabelas de junção.
// Domínios (tipo, status, prioridade...) são varchar validados na API, como no CRISP-DM.
const TABLES = ['system_analyses', 'requirements', 'user_stories', 'diagrams'];

export async function up(knex) {
  // Visão geral da análise: uma linha por projeto
  await knex.schema.createTable('system_analyses', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().unique().references('projects.id').onDelete('CASCADE');
    t.text('goal');
    t.text('scope');
    t.text('technical_description');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('requirements', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable(); // RF1, RNF7, RN3...
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('type', 20).notNullable(); // functional, non_functional, business_rule
    t.string('sub_type', 50); // usabilidade, desempenho, segurança...
    t.string('priority', 10); // must, should, could, wont (MoSCoW)
    t.string('status', 20).notNullable().defaultTo('proposed');
    t.text('technical_description');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  await knex.schema.createTable('user_stories', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('requirement_id').references('requirements.id').onDelete('SET NULL'); // rastreabilidade
    t.string('code', 20).notNullable(); // US1, US2...
    t.string('title', 200).notNullable();
    t.text('as_a').notNullable(); // "Como <papel>"
    t.text('i_want').notNullable(); // "quero <ação>"
    t.text('so_that'); // "para <benefício>"
    t.text('acceptance_criteria');
    t.smallint('story_points');
    t.string('priority', 10);
    t.string('status', 20).notNullable().defaultTo('backlog');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
    t.index('requirement_id');
  });

  await knex.schema.createTable('diagrams', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('title', 200).notNullable();
    t.string('type', 30).notNullable(); // use_case, class, sequence, er, bpmn...
    t.text('description');
    t.string('url', 1000); // imagem/arquivo externo
    t.string('notation', 20); // mermaid, plantuml, drawio...
    t.text('source'); // código-fonte do diagrama na notação acima
    t.timestamps(true, true);
    t.index(['project_id', 'type']);
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
