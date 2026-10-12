import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Módulo CRISP-DM. Fases e status usam enum nativo (estáveis);
// os demais domínios (técnica, operação...) são varchar validados na API, para evoluir sem migration.
const TABLES = [
  'crispdm_phases',
  'crispdm_objectives',
  'crispdm_datasets',
  'crispdm_dataset_fields',
  'crispdm_preparation_steps',
  'crispdm_models',
  'crispdm_model_metrics',
];

export async function up(knex) {
  await knex.raw(`CREATE TYPE crispdm_phase AS ENUM (
    'business_understanding', 'data_understanding', 'data_preparation',
    'modeling', 'evaluation', 'deployment')`);
  await knex.raw(`CREATE TYPE crispdm_phase_status AS ENUM ('not_started', 'in_progress', 'completed')`);

  // Uma linha por fase/projeto; `content` guarda as saídas das tarefas da fase (jsonb)
  await knex.schema.createTable('crispdm_phases', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.specificType('phase', 'crispdm_phase').notNullable();
    t.specificType('status', 'crispdm_phase_status').notNullable().defaultTo('not_started');
    t.jsonb('content').notNullable().defaultTo('{}');
    t.text('notes');
    t.timestamp('started_at', { useTz: true });
    t.timestamp('completed_at', { useTz: true });
    t.timestamps(true, true);
    t.unique(['project_id', 'phase']);
  });

  // Business Understanding: objetivos de negócio e de mineração de dados
  await knex.schema.createTable('crispdm_objectives', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('type', 20).notNullable(); // business | data_mining
    t.text('description').notNullable();
    t.text('success_criteria');
    t.smallint('priority').notNullable().defaultTo(3); // 1 (alta) a 5 (baixa)
    t.boolean('achieved'); // preenchido na Evaluation
    t.timestamps(true, true);
    t.index('project_id');
  });

  // Data Understanding: inventário de datasets
  await knex.schema.createTable('crispdm_datasets', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('source', 200); // ERP, API, planilha...
    t.string('format', 50); // csv, parquet, sql...
    t.string('location', 1000); // URI / caminho
    t.bigInteger('row_count');
    t.integer('column_count');
    t.bigInteger('size_bytes');
    t.date('collected_at');
    t.text('description');
    t.text('quality_notes');
    t.timestamps(true, true);
    t.unique(['project_id', 'name']);
  });

  // Dicionário de dados
  await knex.schema.createTable('crispdm_dataset_fields', (t) => {
    uuidPk(knex, t);
    t.uuid('dataset_id').notNullable().references('crispdm_datasets.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('data_type', 30).notNullable(); // numeric, categorical, text, datetime, boolean, other
    t.string('role', 20).notNullable().defaultTo('feature'); // feature, target, id, ignore
    t.text('description');
    t.decimal('missing_pct', 5, 2);
    t.bigInteger('unique_count');
    t.jsonb('stats'); // { min, max, mean, std, topValues... }
    t.timestamps(true, true);
    t.unique(['dataset_id', 'name']);
  });

  // Data Preparation: passos ordenados
  await knex.schema.createTable('crispdm_preparation_steps', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('dataset_id').references('crispdm_datasets.id').onDelete('SET NULL');
    t.integer('step_order').notNullable();
    t.string('operation', 20).notNullable(); // select, clean, construct, integrate, format
    t.text('description').notNullable();
    t.text('rationale');
    t.string('code_ref', 1000); // link do notebook/script/commit
    t.timestamps(true, true);
    t.index(['project_id', 'step_order']);
  });

  // Modeling
  await knex.schema.createTable('crispdm_models', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('training_dataset_id').references('crispdm_datasets.id').onDelete('SET NULL');
    t.string('name', 200).notNullable();
    t.string('technique', 30).notNullable(); // classification, regression, clustering...
    t.string('algorithm', 200); // RandomForest, XGBoost, KMeans...
    t.jsonb('hyperparameters');
    t.text('assumptions');
    t.string('status', 20).notNullable().defaultTo('candidate'); // candidate, approved, rejected, deployed
    t.string('artifact_uri', 1000);
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['project_id', 'name']);
  });

  // Evaluation: métricas por modelo
  await knex.schema.createTable('crispdm_model_metrics', (t) => {
    uuidPk(knex, t);
    t.uuid('model_id').notNullable().references('crispdm_models.id').onDelete('CASCADE');
    t.string('metric', 50).notNullable(); // accuracy, f1, rmse, auc...
    t.double('value').notNullable();
    t.string('split', 20).notNullable().defaultTo('test'); // train, validation, test, cross_validation
    t.text('notes');
    t.timestamps(true, true);
    t.index('model_id');
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
  await knex.raw('DROP TYPE IF EXISTS crispdm_phase_status');
  await knex.raw('DROP TYPE IF EXISTS crispdm_phase');
}
