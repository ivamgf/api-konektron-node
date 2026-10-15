import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Seção "Scrum" (qualquer tipo de projeto, planos Standard/Master): dados gerais e compromissos,
// papéis, Product/Sprint Backlog, sprints com tasks e incremento, e os eventos.
const TABLES = ['scrum_settings', 'scrum_members', 'scrum_sprints', 'scrum_items', 'scrum_tasks', 'scrum_events'];

export async function up(knex) {
  await knex.schema.createTable('scrum_settings', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().unique().references('projects.id').onDelete('CASCADE');
    t.text('vision');
    t.text('product_goal');
    t.text('definition_of_ready');
    t.text('definition_of_done');
    t.smallint('sprint_length_days').defaultTo(14);
    t.date('start_date');
    t.text('working_agreements');
    t.text('notes');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('scrum_members', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.string('name', 200).notNullable();
    t.string('role', 20).notNullable(); // product_owner, scrum_master, developer, stakeholder
    t.string('email', 254);
    t.text('responsibilities');
    t.integer('capacity_hours');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
    t.index('project_id');
  });

  await knex.schema.createTable('scrum_sprints', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.integer('number').notNullable();
    t.string('name', 200);
    t.text('goal'); // Meta da Sprint
    t.date('start_date');
    t.date('end_date');
    t.string('status', 20).notNullable().defaultTo('planned'); // planned, active, completed, cancelled
    t.text('increment');
    t.string('increment_version', 50);
    t.string('increment_url', 1000);
    t.text('notes');
    t.timestamps(true, true);
    t.unique(['project_id', 'number']);
  });

  // Product Backlog; com sprint_id preenchido, o item está no Sprint Backlog
  await knex.schema.createTable('scrum_items', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('sprint_id').references('scrum_sprints.id').onDelete('SET NULL');
    t.string('code', 20).notNullable();
    t.string('title', 200).notNullable();
    t.string('type', 20).notNullable(); // story, bug, technical, spike
    t.text('description');
    t.text('acceptance_criteria');
    t.smallint('story_points');
    t.smallint('business_value');
    t.string('status', 20).notNullable().defaultTo('new'); // new, ready, in_progress, done
    t.integer('position').notNullable().defaultTo(0); // ordem do Product Backlog
    t.timestamp('done_at', { useTz: true });
    t.timestamps(true, true);
    t.unique(['project_id', 'code']);
    t.index(['project_id', 'position']);
    t.index('sprint_id');
  });

  await knex.schema.createTable('scrum_tasks', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('sprint_id').notNullable().references('scrum_sprints.id').onDelete('CASCADE');
    t.uuid('item_id').references('scrum_items.id').onDelete('SET NULL');
    t.uuid('assignee_id').references('scrum_members.id').onDelete('SET NULL');
    t.string('title', 200).notNullable();
    t.text('description');
    t.string('status', 20).notNullable().defaultTo('todo'); // todo, in_progress, done
    t.decimal('estimate_hours', 7, 2);
    t.decimal('remaining_hours', 7, 2);
    t.integer('position').notNullable().defaultTo(0);
    t.timestamp('done_at', { useTz: true });
    t.timestamps(true, true);
    t.index(['sprint_id', 'status']);
  });

  await knex.schema.createTable('scrum_events', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('sprint_id').references('scrum_sprints.id').onDelete('SET NULL');
    t.string('type', 20).notNullable(); // planning, daily, review, retrospective, refinement
    t.date('date').notNullable();
    t.integer('duration_minutes');
    t.uuid('facilitator_id').references('scrum_members.id').onDelete('SET NULL');
    t.jsonb('participant_ids').notNullable().defaultTo('[]');
    t.text('notes');
    t.text('decisions');
    t.jsonb('updates').notNullable().defaultTo('[]'); // daily: [{ memberId, yesterday, today, impediments }]
    t.text('impediments');
    t.text('went_well'); // retrospectiva
    t.text('to_improve');
    t.text('action_items');
    t.text('feedback'); // review
    t.timestamps(true, true);
    t.index(['project_id', 'date']);
  });

  for (const table of TABLES) await addUpdatedAtTrigger(knex, table);
}

export async function down(knex) {
  for (const table of [...TABLES].reverse()) await knex.schema.dropTableIfExists(table);
}
