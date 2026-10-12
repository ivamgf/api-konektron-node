import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Contêiner de todos os artefatos: engenharia de software ou análise de dados (CRISP-DM)
export async function up(knex) {
  await knex.schema.createTable('projects', (t) => {
    uuidPk(knex, t);
    t.uuid('owner_id').notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('type', 'project_type').notNullable().defaultTo('software');
    t.string('name', 200).notNullable();
    t.text('description');
    t.string('version', 20).notNullable().defaultTo('1.0.0');
    t.timestamps(true, true);
    t.timestamp('deleted_at', { useTz: true });
    t.index(['owner_id', 'type']);
  });
  await addUpdatedAtTrigger(knex, 'projects');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('projects');
}
