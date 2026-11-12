import { addUpdatedAtTrigger, uuidPk } from '../helpers.js';

// Planos com cobrança pelo Asaas, limite e expiração dos projetos do Free e compartilhamento de projetos.
export async function up(knex) {
  await knex.schema.alterTable('users', (t) => {
    // projetos criados na vida da conta: no Free, excluir um projeto não devolve a vaga
    t.integer('projects_created').notNullable().defaultTo(0);
    t.string('asaas_customer_id', 40).unique();
    t.string('cpf_cnpj', 14); // só dígitos; exigido pelo Asaas para emitir a cobrança
  });
  await knex.raw(`
    UPDATE users u SET projects_created = c.total
    FROM (SELECT owner_id, count(*)::int AS total FROM projects GROUP BY owner_id) c
    WHERE c.owner_id = u.id
  `);

  // último acesso ao projeto (por qualquer participante): no Free, 3 meses sem uso excluem o projeto
  await knex.schema.alterTable('projects', (t) => {
    t.timestamp('last_used_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw('UPDATE projects SET last_used_at = updated_at');

  // Assinaturas mensais no Asaas (uma linha por assinatura criada lá)
  await knex.schema.createTable('subscriptions', (t) => {
    uuidPk(knex, t);
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.specificType('plan', 'user_plan').notNullable();
    t.integer('amount').notNullable(); // centavos por mês
    // pending (aguardando o 1º pagamento), active, overdue, canceled
    t.string('status', 20).notNullable().defaultTo('pending');
    t.string('asaas_subscription_id', 40).unique();
    t.date('next_due_date');
    t.timestamp('paid_until', { useTz: true }); // fim do período coberto pelos pagamentos confirmados
    t.timestamp('activated_at', { useTz: true }); // 1º pagamento confirmado
    t.timestamp('canceled_at', { useTz: true });
    t.timestamp('refunded_at', { useTz: true }); // arrependimento (CDC art. 49)
    t.timestamp('terms_accepted_at', { useTz: true });
    t.timestamps(true, true);
    t.index(['user_id', 'status']);
  });
  await addUpdatedAtTrigger(knex, 'subscriptions');

  // Cobranças de cada assinatura, espelhadas do Asaas
  await knex.schema.createTable('payments', (t) => {
    uuidPk(knex, t);
    t.uuid('subscription_id').notNullable().references('subscriptions.id').onDelete('CASCADE');
    t.string('asaas_payment_id', 40).notNullable().unique();
    t.integer('amount').notNullable(); // centavos
    t.string('status', 40).notNullable();
    t.string('billing_type', 30);
    t.date('due_date').notNullable();
    t.timestamp('paid_at', { useTz: true });
    t.string('invoice_url', 500);
    t.timestamps(true, true);
    t.index(['subscription_id', 'due_date']);
  });
  await addUpdatedAtTrigger(knex, 'payments');

  // Avisos do webhook do Asaas já tratados (o Asaas entrega "pelo menos uma vez")
  await knex.schema.createTable('payment_events', (t) => {
    t.string('id', 60).primary(); // id do evento no Asaas
    t.string('event', 60).notNullable();
    t.uuid('subscription_id').references('subscriptions.id').onDelete('SET NULL');
    t.jsonb('payload').notNullable();
    t.timestamp('processed_at', { useTz: true });
    t.text('error');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  // Participantes de um projeto, convidados pelo dono: o projeto inteiro ou só o Kanban
  await knex.schema.createTable('project_members', (t) => {
    uuidPk(knex, t);
    t.uuid('project_id').notNullable().references('projects.id').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    t.string('access', 10).notNullable().defaultTo('project');
    t.uuid('granted_by').references('users.id').onDelete('SET NULL');
    t.timestamps(true, true);
    t.unique(['project_id', 'user_id']);
    t.index(['user_id']);
  });
  await knex.raw(`ALTER TABLE project_members ADD CONSTRAINT project_members_access_check CHECK (access IN ('project', 'kanban'))`);
  await addUpdatedAtTrigger(knex, 'project_members');
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('project_members');
  await knex.schema.dropTableIfExists('payment_events');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.alterTable('projects', (t) => t.dropColumn('last_used_at'));
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('projects_created');
    t.dropColumn('asaas_customer_id');
    t.dropColumn('cpf_cnpj');
  });
}
