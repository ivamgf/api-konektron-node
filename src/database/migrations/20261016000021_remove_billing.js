import { up as createSubscriptions } from './20261016000020_subscriptions.js';

// Fim da cobrança: as assinaturas do PagBank saem do sistema e todos os planos acessam todas as seções.
// Os perfis continuam distintos; todos voltam ao Free e só o dono fica administrador com plano Master
// (depois, quem muda o perfil é ele, no painel de administração).
const OWNER_EMAIL = 'ivam.developer@gmail.com';

export async function up(knex) {
  await knex.schema.dropTableIfExists('payment_events');
  await knex.schema.dropTableIfExists('subscriptions');

  await knex('users').whereNot({ email: OWNER_EMAIL }).update({ plan: 'free' });
  await knex('users').whereNot({ email: OWNER_EMAIL }).where({ role: 'admin' }).update({ role: 'client' });
  await knex('users').where({ email: OWNER_EMAIL }).update({ role: 'admin', plan: 'master' });
}

// Recria as tabelas vazias; os perfis anteriores não são restaurados
export async function down(knex) {
  await createSubscriptions(knex);
}
