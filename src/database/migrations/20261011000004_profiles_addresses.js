import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// RF3 - Perfil
export async function up(knex) {
  await knex.schema.createTable('profiles', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().unique().references('users.id').onDelete('CASCADE');
    t.string('full_name', 200);
    t.string('nickname', 100);
    t.string('avatar_url', 500);
    t.string('phone_mobile', 20);
    t.string('phone_landline', 20);
    t.string('company', 200);
    t.string('department', 200);
    t.string('job_title', 200);
    t.string('locale', 10).notNullable().defaultTo('en'); // RNF5
    t.timestamps(true, true);
  });

  // "sistema deve permitir adição de campos" de redes sociais
  await knex.schema.createTable('social_networks', (t) => {
    uuidPk(knex, t);
    t.uuid('profile_id').notNullable().references('profiles.id').onDelete('CASCADE');
    t.string('network', 50).notNullable();
    t.string('url', 500).notNullable();
    t.timestamps(true, true);
    t.index('profile_id');
  });

  await knex.schema.createTable('addresses', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('street', 200).notNullable();
    t.string('number', 20);
    t.string('complement', 200);
    t.string('district', 200);
    t.string('city', 200).notNullable();
    t.string('state', 50).notNullable();
    t.string('postal_code', 20);
    t.string('country', 2).notNullable().defaultTo('BR');
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index('user_id');
  });
  // No máximo um endereço principal por usuário
  await knex.raw(
    'CREATE UNIQUE INDEX addresses_one_primary_per_user ON addresses (user_id) WHERE is_primary',
  );

  for (const table of ['profiles', 'social_networks', 'addresses']) {
    await addUpdatedAtTrigger(knex, table);
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('addresses');
  await knex.schema.dropTableIfExists('social_networks');
  await knex.schema.dropTableIfExists('profiles');
}
