import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "CommonKADS" (qualquer tipo de projeto, plano Master): planilhas dos modelos de
// organização, tarefa, agente, conhecimento, comunicação e projeto, com a extensão MAS-CommonKADS.
// As listas de vínculos (agent_ids, knowledge_ids...) são jsonb de uuids validados na API.
const TABLES = ['ck_worksheets', 'ck_agents', 'ck_knowledge', 'ck_tasks', 'ck_transactions'];

export async function up(knex) {
  // Situação de cada planilha e o conteúdo das de texto livre (OM-1, OM-2, OM-5, OTA-1, KM-1, DM-1..4)
  await knex.schema.createTable('ck_worksheets', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('worksheet', 10).notNullable(); // om-1, tm-2, dm-4...
    t.string('status', 20).notNullable().defaultTo('not_started');
    t.jsonb('content').notNullable().defaultTo('{}');
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['project_id', 'worksheet']);
  });

  // AM-1 + MAS-CommonKADS
  await knex.schema.createTable('ck_agents', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('kind', 20).notNullable(); // human, information_system, other
    t.text('organization');
    t.jsonb('knowledge_ids').notNullable().defaultTo('[]');
    t.jsonb('communicates_with_ids').notNullable().defaultTo('[]');
    t.text('other_competences');
    t.text('responsibilities');
    t.text('input_parameters');
    t.text('activation_condition');
    t.text('termination_condition');
    t.text('success_condition');
    t.text('failure_condition');
    t.string('representation_language', 200);
    t.text('ontology');
    t.text('info_evolution');
    t.text('info_effect');
    t.text('info_association');
    t.text('ai_technique');
    t.timestamps(true, true);
    t.index('project_id');
  });

  // OM-4 + TM-2
  await knex.schema.createTable('ck_knowledge', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('domain', 300);
    for (const what of ['right_form', 'right_place', 'right_time', 'right_quality']) {
      t.boolean(what);
      t.text(`${what}_notes`);
    }
    t.jsonb('characterization').notNullable().defaultTo('{}'); // { nature, form, availability }
    t.timestamps(true, true);
    t.index('project_id');
  });

  // OM-3 + TM-1
  await knex.schema.createTable('ck_tasks', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable();
    t.string('name', 200).notNullable();
    t.jsonb('agent_ids').notNullable().defaultTo('[]');
    t.jsonb('knowledge_ids').notNullable().defaultTo('[]');
    t.string('location', 200);
    t.boolean('knowledge_intensive');
    t.smallint('significance'); // 1 a 5
    t.text('organization');
    t.text('goal_value');
    t.text('dependency_flow');
    t.text('objects_handled');
    t.text('timing_control');
    t.text('knowledge_competence');
    t.text('resources');
    t.text('quality_performance');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  // CM-1 + CM-2
  await knex.schema.createTable('ck_transactions', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('code', 20).notNullable();
    t.string('name', 200).notNullable();
    t.text('purpose');
    t.string('information_object', 500);
    t.uuid('from_task_id').references('ck_tasks.id').onDelete('SET NULL');
    t.uuid('to_task_id').references('ck_tasks.id').onDelete('SET NULL');
    t.uuid('sender_agent_id').references('ck_agents.id').onDelete('SET NULL');
    t.uuid('receiver_agent_id').references('ck_agents.id').onDelete('SET NULL');
    t.text('communication_plan');
    t.text('constraints');
    t.jsonb('information_items').notNullable().defaultTo('[]'); // [{ name, role, form, medium }]
    t.jsonb('messages').notNullable().defaultTo('[]'); // [{ type, content, reference }]
    t.text('message_control');
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
