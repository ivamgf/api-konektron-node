import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Assinaturas mensais pagas no Checkout Recorrente do PagBank. O id da linha vai como reference_id
// do checkout; cada checkout cria um plano no PagBank (pagbank_plan_id), que identifica a assinatura
// gerada depois do primeiro pagamento.
export async function up(knex) {
  await knex.schema.createTable('subscriptions', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('plan', 'user_plan').notNullable();
    t.integer('amount').notNullable(); // centavos, por mês
    // checkout (aguardando pagamento) e, depois, os status do PagBank em minúsculas:
    // pending, active, trial, overdue, pending_action, suspended, canceled, expired
    t.string('status', 20).notNullable().defaultTo('checkout');
    t.string('checkout_id', 64).unique();
    t.string('pay_url', 500);
    t.timestamp('checkout_expires_at', { useTz: true });
    t.string('pagbank_plan_id', 64).unique();
    t.string('pagbank_subscription_id', 64).unique();
    t.string('order_id', 64); // pedido do primeiro pagamento
    t.date('next_invoice_at');
    t.timestamp('activated_at', { useTz: true }); // 1º pagamento aprovado
    t.timestamp('canceled_at', { useTz: true });
    // cancelada depois dos 7 dias de arrependimento: o acesso segue até o fim do período pago
    t.timestamp('access_until', { useTz: true });
    // arrependimento (CDC art. 49): cancelada em até 7 dias, com estorno integral do 1º pagamento
    t.string('refund_id', 64);
    t.timestamp('refunded_at', { useTz: true });
    t.timestamp('terms_accepted_at', { useTz: true }); // aceite dos termos e da cobrança recorrente
    t.timestamps(true, true);
    t.index(['user_id', 'status']);
  });
  await addUpdatedAtTrigger(knex, 'subscriptions');

  // Notificações recebidas do PagBank (diagnóstico e conferência)
  await knex.schema.createTable('payment_events', (t) => {
    t.bigIncrements('id');
    t.string('event', 60).notNullable(); // subscription.*, order, checkout
    t.string('resource_id', 64);
    t.uuid('subscription_id').references('subscriptions.id').onDelete('SET NULL');
    t.string('status', 30);
    t.boolean('verified').notNullable().defaultTo(false); // estado confirmado na API do PagBank
    t.jsonb('payload').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['subscription_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('payment_events');
  await knex.schema.dropTableIfExists('subscriptions');
}
