import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Visão de Sistema" (projetos `software`, planos Standard/Master): extensão da Análise de
// Sistemas com a especificação de requisitos no estilo da "Planilha de Análise" / ISO 29148,
// casos de uso documentados como em Guedes (UML 2, tab. 3.1) e cenários BDD (Gherkin).
// Requisitos, histórias e diagramas continuam nas tabelas da Análise de Sistemas.
const TABLES = [
  'system_specs', 'stakeholders', 'glossary_terms', 'use_cases', 'use_case_flows', 'use_case_relations', 'bdd_scenarios',
];

export async function up(knex) {
  // Definições do software (aba "Definições"); escopo e visão geral vêm de system_analyses
  await knex.schema.createTable('system_specs', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().unique().references('projects.id').onDelete('CASCADE');
    t.string('responsible', 200);
    t.string('organization', 200);
    t.text('purpose'); // finalidade
    t.text('product_perspective');
    t.text('user_characteristics');
    t.text('constraints'); // restrições
    t.text('assumptions'); // suposições e dependências
    t.text('references');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('stakeholders', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable(); // P1, P2...
    t.string('name', 200).notNullable();
    t.string('role', 200); // cargo/função
    t.text('interest'); // interesse no projeto
    t.text('responsibility');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  // Conceitos e vocabulário do domínio
  await knex.schema.createTable('glossary_terms', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable(); // C1, C2...
    t.string('term', 200).notNullable();
    t.text('definition').notNullable();
    t.text('synonyms');
    t.text('relationships');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  await knex.schema.createTable('use_cases', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable(); // UC001...
    t.string('name', 200).notNullable(); // verbo no infinitivo: "Abrir conta"
    t.uuid('general_use_case_id').references('use_cases.id').onDelete('SET NULL'); // generalização
    t.string('primary_actor', 200).notNullable();
    t.text('secondary_actors'); // um por linha
    t.text('summary');
    t.text('preconditions');
    t.text('postconditions');
    t.text('restrictions'); // restrições/validações (regras de negócio do caso de uso)
    t.jsonb('requirement_ids').notNullable().defaultTo('[]'); // rastreabilidade com requirements
    t.string('priority', 10); // MoSCoW
    t.string('status', 20).notNullable().defaultTo('draft');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  // Cenários do caso de uso: um principal, alternativos e de exceção, com passos ator/sistema
  await knex.schema.createTable('use_case_flows', (t) => {
    uuidPk(knex, t);
    t.uuid('use_case_id').notNullable().references('use_cases.id').onDelete('CASCADE');
    t.string('kind', 20).notNullable(); // main, alternative, exception
    t.string('title', 200).notNullable();
    t.integer('position').notNullable().defaultTo(0);
    t.jsonb('steps').notNullable().defaultTo('[]'); // [{ actor, system }]
    t.timestamps(true, true);
    t.index(['use_case_id', 'position']);
  });

  // <<include>> e <<extend>> entre casos de uso do mesmo projeto
  await knex.schema.createTable('use_case_relations', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('from_use_case_id').notNullable().references('use_cases.id').onDelete('CASCADE');
    t.uuid('to_use_case_id').notNullable().references('use_cases.id').onDelete('CASCADE');
    t.string('type', 10).notNullable(); // include, extend
    t.string('extension_point', 200);
    t.text('condition'); // restrição da extensão
    t.timestamps(true, true);
    t.unique(['from_use_case_id', 'to_use_case_id', 'type']);
    t.index('project_id');
  });

  // Cenários BDD; passos guardados sem palavras-chave (o Gherkin é gerado no idioma pedido)
  await knex.schema.createTable('bdd_scenarios', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('user_story_id').references('user_stories.id').onDelete('SET NULL'); // funcionalidade
    t.uuid('use_case_id').references('use_cases.id').onDelete('SET NULL'); // origem
    t.string('title', 200).notNullable();
    t.string('tags', 200); // "@login @smoke"
    t.text('given'); // um passo por linha
    t.text('when');
    t.text('then');
    t.text('examples'); // tabela "| a | b |" → Esquema do Cenário
    t.integer('position').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(['project_id', 'user_story_id']);
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
