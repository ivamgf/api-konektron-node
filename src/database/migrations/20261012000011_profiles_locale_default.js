// Português passa a ser o idioma padrão dos perfis novos (a interface já abre em pt-BR).
// Perfis existentes mantêm o idioma que têm; o espanhol (`es`) é validado na API.
export async function up(knex) {
  await knex.schema.alterTable('profiles', (t) => {
    t.string('locale', 10).notNullable().defaultTo('pt-BR').alter();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('profiles', (t) => {
    t.string('locale', 10).notNullable().defaultTo('en').alter();
  });
}
