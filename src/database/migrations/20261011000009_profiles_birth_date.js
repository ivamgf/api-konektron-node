// Data de nascimento no perfil (o `dateBirth` da API legada).
// Migration própria: bancos criados antes já aplicaram a 000004 sem esta coluna,
// e migrations aplicadas nunca são editadas.
export async function up(knex) {
  await knex.schema.alterTable('profiles', (t) => {
    t.date('birth_date');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('profiles', (t) => {
    t.dropColumn('birth_date');
  });
}
