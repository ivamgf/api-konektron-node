// Master vitalício: plano Master sem cobrança, concedido só pelo administrador (não aparece nas páginas públicas).
// O dono do sistema fica administrador, Master e vitalício.
const OWNER_EMAIL = 'ivam.developer@gmail.com';

export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    t.boolean('lifetime').notNullable().defaultTo(false);
  });
  await knex('users').where({ email: OWNER_EMAIL }).update({ role: 'admin', plan: 'master', lifetime: true });
}

export async function down(knex) {
  await knex.schema.alterTable('users', (t) => t.dropColumn('lifetime'));
}
