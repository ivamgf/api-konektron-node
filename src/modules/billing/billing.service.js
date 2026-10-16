import { env } from '#config/env.js';
import { PAID_PLANS, PLAN_SECTIONS, PLANS, ROLES } from '#config/plans.js';
import { db } from '#database/connection.js';
import { pagbank, pagbankEnabled } from '#services/pagbank.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';

const PLAN_NAMES = { [PLANS.STANDARD]: 'Standard', [PLANS.MASTER]: 'Master' };
const PRICES = () => ({ [PLANS.STANDARD]: env.PLAN_PRICE_STANDARD, [PLANS.MASTER]: env.PLAN_PRICE_MASTER });
const CHECKOUT_TTL_MS = 2 * 3_600_000; // validade padrão do checkout no PagBank
const REUSE_MARGIN_MS = 15 * 60_000; // reaproveita o checkout aberto se ainda faltar esse tempo
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Assinatura viva no PagBank. ACTIVE e TRIAL liberam o plano. OVERDUE e PENDING_ACTION só mantêm o
// acesso de quem já pagou ao menos uma vez (retentativas de um mês seguinte): no sandbox, o 1º pagamento
// recusado cria a assinatura já em OVERDUE, e isso não pode liberar o plano.
const PAID_STATUSES = ['active', 'trial'];
const GRACE_STATUSES = ['overdue', 'pending_action'];
export const ACCESS_STATUSES = Object.freeze([...PAID_STATUSES, ...GRACE_STATUSES]);
// Cancelada depois do prazo de arrependimento: a cobrança para, mas o mês já pago é usufruído até o fim
export const hasAccess = (s, now = new Date()) =>
  PAID_STATUSES.includes(s?.status) ||
  (GRACE_STATUSES.includes(s?.status) && Boolean(s.activatedAt)) ||
  (s?.status === 'canceled' && Boolean(s.accessUntil) && new Date(s.accessUntil) > now);
// Direito de arrependimento (CDC art. 49): 7 dias a contar do 1º pagamento, com devolução integral
export const WITHDRAWAL_DAYS = 7;
export const inWithdrawalPeriod = (s, now = new Date()) =>
  Boolean(s?.activatedAt) && now - new Date(s.activatedAt) <= WITHDRAWAL_DAYS * 86_400_000;
// next_invoice_at vem como data (horário de Brasília): o período pago vai até o início desse dia
export const endOfPaidPeriod = (nextInvoiceAt) =>
  nextInvoiceAt ? new Date(`${String(nextInvoiceAt).slice(0, 10)}T00:00:00-03:00`) : null;
// Ainda sem assinatura no PagBank: o cliente não concluiu o primeiro pagamento
export const OPEN_STATUSES = Object.freeze(['checkout', 'pending']);
const FINAL_STATUSES = ['canceled', 'expired', 'checkout_expired'];
const COLUMNS = [
  'id', 'plan', 'amount', 'status', 'payUrl', 'checkoutExpiresAt', 'nextInvoiceAt', 'activatedAt', 'canceledAt', 'accessUntil', 'refundedAt',
  'createdAt', 'updatedAt',
];

export const toLocalStatus = (status) => String(status ?? '').trim().toLowerCase() || null;

// Plano que o usuário deve ter: o maior entre as assinaturas que dão acesso; sem nenhuma, Free
export function effectivePlan(subscriptions) {
  const ranks = subscriptions.filter((s) => hasAccess(s)).map((s) => PAID_PLANS.indexOf(s.plan));
  const best = Math.max(-1, ...ranks);
  return best >= 0 ? PAID_PLANS[best] : PLANS.FREE;
}

export function planCatalog() {
  const prices = PRICES();
  return {
    enabled: pagbankEnabled(),
    currency: 'BRL',
    interval: 'MONTH',
    plans: PAID_PLANS.filter((plan) => prices[plan]).map((plan) => ({
      plan,
      amount: prices[plan],
      sections: PLAN_SECTIONS[plan],
    })),
  };
}

// ISO-8601 sem milissegundos, como nos exemplos do PagBank
const isoSeconds = (date) => date.toISOString().replace(/\.\d{3}Z$/, '+00:00');
// O firewall do PagBank recusa (403) checkouts com URLs locais: só mandamos URLs públicas
const LOCAL_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i;
export function isPublicUrl(value, { httpsOnly = false } = {}) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || (!httpsOnly && url.protocol === 'http:')) && !LOCAL_HOST.test(url.hostname);
  } catch {
    return false;
  }
}
const notificationUrl = () =>
  isPublicUrl(env.API_URL, { httpsOnly: true }) ? `${env.API_URL.replace(/\/$/, '')}/api/v1/billing/webhooks/pagbank` : null;

// Corpo do POST /checkouts com recurrence_plan (Checkout Recorrente, só cartão de crédito).
// Os dados do comprador são pedidos na página do PagBank (customer_modifiable).
export function buildCheckoutPayload({ id, plan, amount, expiresAt }) {
  const name = `KonekTron ${PLAN_NAMES[plan]}`;
  const appUrl = env.APP_URL.replace(/\/$/, '');
  const back = isPublicUrl(appUrl) ? `${appUrl}/billing/return?ref=${id}` : null;
  const webhook = notificationUrl();
  return {
    reference_id: id,
    expiration_date: isoSeconds(expiresAt),
    customer_modifiable: true,
    items: [{ reference_id: plan, name: `${name} (mensal)`, quantity: 1, unit_amount: amount }],
    payment_methods: [{ type: 'CREDIT_CARD' }],
    payment_methods_configs: [{ type: 'CREDIT_CARD', config_options: [{ option: 'INSTALLMENTS_LIMIT', value: '1' }] }],
    soft_descriptor: 'KONEKTRON',
    // sem APP_URL pública (desenvolvimento local) o comprador não volta sozinho ao app
    ...(back && { redirect_url: back, return_url: back }),
    ...(webhook && { notification_urls: [webhook], payment_notification_urls: [webhook] }),
    // sem billing_cycles: a assinatura não expira, cobra todo mês até ser cancelada
    recurrence_plan: { name, interval: { unit: 'MONTH', length: 1 } },
  };
}

const payLink = (checkout) => checkout?.links?.find((l) => l.rel === 'PAY')?.href ?? null;
const subscriptionsOf = (userId) => db('subscriptions').where({ userId });

// Grava o plano efetivo no usuário. As mudanças chegam ao token de acesso na próxima renovação.
export async function syncUserPlan(userId, trx = db) {
  const subs = await trx('subscriptions').where({ userId }).select('plan', 'status', 'activatedAt', 'accessUntil');
  const plan = effectivePlan(subs);
  await trx('users').where({ id: userId }).whereNot({ role: ROLES.ADMIN }).update({ plan });
  return plan;
}

// Aplica o estado vindo do PagBank a uma assinatura local
async function applyRemote(row, changes) {
  const next = { ...changes };
  // aviso atrasado (ex.: PENDING depois do pedido pago) não tira o acesso já liberado
  if (hasAccess(row) && OPEN_STATUSES.includes(next.status)) delete next.status;
  if (!next.status) delete next.status;
  if (PAID_STATUSES.includes(next.status) && !row.activatedAt) next.activatedAt = new Date();
  if (FINAL_STATUSES.includes(next.status) && !row.canceledAt) next.canceledAt = new Date();
  const [updated] = await db('subscriptions').where({ id: row.id }).update(next).returning('*');
  await syncUserPlan(row.userId);

  // Troca de plano: a assinatura nova ativa encerra as anteriores (o PagBank não cobra as duas)
  if (hasAccess(updated) && !hasAccess(row)) {
    const others = await subscriptionsOf(row.userId).whereNot({ id: row.id }).whereIn('status', ACCESS_STATUSES);
    for (const old of others) await cancelRow(old).catch((err) => logger.error({ err, id: old.id }, 'Falha ao encerrar a assinatura anterior'));
  }
  return updated;
}

function remoteChanges(remote) {
  return {
    status: toLocalStatus(remote.status),
    pagbankSubscriptionId: remote.id,
    nextInvoiceAt: remote.next_invoice_at ?? null,
  };
}

async function cancelRow(row, { accessUntil = null } = {}) {
  if (row.pagbankSubscriptionId) {
    await pagbank.cancelSubscription(row.pagbankSubscriptionId).catch((err) => {
      // já cancelada no PagBank (ex.: pelo painel): segue e marca aqui
      if (err.upstreamStatus !== 400 && err.upstreamStatus !== 409) throw err;
    });
  } else if (row.checkoutId) {
    await pagbank.inactivateCheckout(row.checkoutId).catch(() => {});
  }
  const [updated] = await db('subscriptions')
    .where({ id: row.id })
    .update({ status: 'canceled', canceledAt: new Date(), accessUntil })
    .returning('*');
  await syncUserPlan(row.userId);
  return updated;
}

// Assinatura gerada pelo checkout: localiza no PagBank pelo plano exclusivo do checkout
async function findRemoteForRow(row, email) {
  if (row.pagbankSubscriptionId) return pagbank.getSubscription(row.pagbankSubscriptionId);
  if (!row.pagbankPlanId) return null;
  // o PagBank exige início e fim juntos; um dia de folga em cada ponta cobre o fuso (datas em horário de Brasília)
  const day = (ms) => new Date(ms).toISOString().slice(0, 10);
  const data = await pagbank.listSubscriptions({
    q: email,
    created_at_start: day(new Date(row.createdAt).getTime() - 86_400_000),
    created_at_end: day(Date.now() + 86_400_000),
  });
  const list = data?.subscriptions ?? data?.data ?? (Array.isArray(data) ? data : []);
  return list.find((s) => s.plan?.id === row.pagbankPlanId) ?? null;
}

// Arrependimento: estorno total dos pagamentos aprovados da assinatura (na prática, o 1º mês)
async function refundPayments(row) {
  const refunds = [];
  const { invoices = [] } = (await pagbank.listInvoices(row.pagbankSubscriptionId)) ?? {};
  for (const invoice of invoices.filter((i) => i.status === 'PAID')) {
    const { payments = [] } = (await pagbank.listInvoicePayments(invoice.id)) ?? {};
    for (const payment of payments.filter((p) => p.status === 'APPROVED')) {
      const refund = await pagbank.refundPayment(payment.id, invoice.amount);
      refunds.push(refund.id);
    }
  }
  return refunds;
}

const recordEvent = (event) =>
  db('payment_events')
    .insert(event)
    .catch((err) => logger.error({ err }, 'Falha ao registrar o evento do PagBank'));

export const billingService = {
  catalog: planCatalog,

  // Assinatura atual (a que dá acesso ou a mais recente) e o histórico do usuário
  async overview(userId) {
    const [user, history] = await Promise.all([
      db('users').where({ id: userId }).first('plan', 'role'),
      subscriptionsOf(userId).select(COLUMNS).orderBy('createdAt', 'desc').limit(20),
    ]);
    const current =
      history.find((s) => hasAccess(s)) ??
      history.find((s) => OPEN_STATUSES.includes(s.status) && (!s.checkoutExpiresAt || new Date(s.checkoutExpiresAt) > new Date())) ??
      null;
    return { plan: user?.plan ?? PLANS.FREE, role: user?.role, current, history, ...planCatalog() };
  },

  // Cria (ou reaproveita) o Checkout Recorrente e devolve o link de pagamento
  async createCheckout(userId, plan, { termsAcceptedAt = new Date() } = {}) {
    if (!pagbankEnabled()) throw new AppError('Pagamentos não configurados', 503);
    const amount = PRICES()[plan];
    if (!amount) throw new AppError('Plano indisponível para assinatura', 400, { plan: ['sem preço configurado'] });

    const user = await db('users').where({ id: userId, isActive: true }).whereNull('deletedAt').first('id', 'role');
    if (!user) throw AppError.notFound('Usuário');
    if (user.role === ROLES.ADMIN) throw new AppError('Administradores já acessam todas as seções', 400);

    const subs = await subscriptionsOf(userId);
    if (subs.some((s) => s.plan === plan && hasAccess(s) && s.status !== 'canceled')) {
      throw new AppError('Você já assina este plano', 409);
    }
    const open = subs.find(
      (s) => s.plan === plan && s.status === 'checkout' && s.payUrl && s.amount === amount &&
        new Date(s.checkoutExpiresAt) - Date.now() > REUSE_MARGIN_MS,
    );
    if (open) {
      await db('subscriptions').where({ id: open.id }).update({ termsAcceptedAt });
      return { id: open.id, payUrl: open.payUrl, expiresAt: open.checkoutExpiresAt };
    }

    const expiresAt = new Date(Date.now() + CHECKOUT_TTL_MS);
    const [row] = await db('subscriptions').insert({ userId, plan, amount, checkoutExpiresAt: expiresAt, termsAcceptedAt }).returning('*');
    try {
      const checkout = await pagbank.createCheckout(buildCheckoutPayload({ id: row.id, plan, amount, expiresAt }), row.id);
      const payUrl = payLink(checkout);
      if (!payUrl) {
        logger.error({ checkout }, 'Checkout do PagBank sem link de pagamento');
        throw new AppError('O PagBank não devolveu o link de pagamento', 502);
      }
      const [saved] = await db('subscriptions')
        .where({ id: row.id })
        .update({
          checkoutId: checkout.id,
          payUrl,
          pagbankPlanId: checkout.recurrence_plan?.id ?? null,
          checkoutExpiresAt: checkout.expiration_date ? new Date(checkout.expiration_date) : expiresAt,
        })
        .returning(['id', 'payUrl', 'checkoutExpiresAt']);
      return { id: saved.id, payUrl: saved.payUrl, expiresAt: saved.checkoutExpiresAt };
    } catch (err) {
      // sem link gravado, a linha não serve para nada
      await db('subscriptions').where({ id: row.id }).del();
      throw err;
    }
  },

  // Volta do checkout: confere no PagBank, sem depender do webhook (útil também em desenvolvimento)
  async refresh(userId, id) {
    const row = await subscriptionsOf(userId).where({ id }).first();
    if (!row) throw AppError.notFound('Assinatura');
    if (pagbankEnabled() && !FINAL_STATUSES.includes(row.status) && row.status !== 'suspended') {
      const user = await db('users').where({ id: userId }).first('email');
      try {
        const remote = await findRemoteForRow(row, user.email);
        if (remote) await applyRemote(row, remoteChanges(remote));
        else if (row.status === 'checkout' && row.checkoutExpiresAt && new Date(row.checkoutExpiresAt) < new Date()) {
          await applyRemote(row, { status: 'checkout_expired' });
        }
      } catch (err) {
        // sem resposta do PagBank: devolve o que temos; o webhook atualiza depois
        logger.warn({ err, id }, 'Não foi possível conferir a assinatura no PagBank');
      }
    }
    const [updated, user] = await Promise.all([
      subscriptionsOf(userId).where({ id }).first(COLUMNS),
      db('users').where({ id: userId }).first('plan'),
    ]);
    return { subscription: updated, plan: user.plan };
  },

  /**
   * Cancela a assinatura (ou o checkout em aberto). A cobrança para na hora no PagBank.
   *  - Até 7 dias do 1º pagamento (arrependimento, CDC art. 49): estorno integral e o acesso termina.
   *  - Depois: sem estorno proporcional; o acesso segue até o fim do período já pago.
   */
  async cancel(userId) {
    let row =
      (await subscriptionsOf(userId).whereIn('status', ACCESS_STATUSES).orderBy('createdAt', 'desc').first()) ??
      (await subscriptionsOf(userId).whereIn('status', OPEN_STATUSES).orderBy('createdAt', 'desc').first());
    if (!row) throw new AppError('Você não tem assinatura ativa', 404);

    const withdrawal = inWithdrawalPeriod(row) && Boolean(row.pagbankSubscriptionId);
    if (!withdrawal && hasAccess(row) && !row.nextInvoiceAt && row.pagbankSubscriptionId) {
      const remote = await pagbank.getSubscription(row.pagbankSubscriptionId).catch(() => null);
      row = { ...row, nextInvoiceAt: remote?.next_invoice_at ?? null };
    }
    const accessUntil = !withdrawal && hasAccess(row) ? endOfPaidPeriod(row.nextInvoiceAt) : null;
    let updated = await cancelRow(row, { accessUntil });

    let refund = null;
    if (withdrawal) {
      try {
        const ids = await refundPayments(row);
        [updated] = await db('subscriptions')
          .where({ id: row.id })
          .update({ refundId: ids[0] ?? null, refundedAt: ids.length ? new Date() : null })
          .returning('*');
        refund = { requested: ids.length > 0 };
      } catch (err) {
        // a assinatura já está cancelada; o estorno fica para o atendimento
        logger.error({ err, id: row.id }, 'Falha no estorno do arrependimento');
        refund = { requested: false, failed: true };
      }
    }
    return {
      subscription: Object.fromEntries(COLUMNS.map((c) => [c, updated[c]])),
      plan: await syncUserPlan(userId),
      withdrawal,
      refund,
    };
  },

  // Rotina periódica: quem cancelou mantém o plano até accessUntil; vencido o prazo, volta ao Free
  async expireAccess() {
    const rows = await db('subscriptions')
      .distinct('userId')
      .where({ status: 'canceled' })
      .where('accessUntil', '<=', db.fn.now())
      .where('accessUntil', '>', db.raw("now() - interval '3 days'"));
    for (const { userId } of rows) await syncUserPlan(userId);
    return rows.length;
  },

  // Conta excluída: nenhuma cobrança deve continuar
  async cancelAllForUser(userId) {
    const rows = await subscriptionsOf(userId).whereNotIn('status', [...FINAL_STATUSES, 'suspended']);
    for (const row of rows) {
      await cancelRow(row).catch((err) => logger.error({ err, id: row.id }, 'Falha ao cancelar a assinatura da conta excluída'));
    }
  },

  /**
   * Notificação do PagBank. O corpo serve só de aviso: o estado é sempre relido na API do PagBank
   * (com o nosso token), então um aviso forjado não libera acesso.
   *   - Assinaturas: { event: 'subscription.*', resource: { id: 'SUBS_…' } } (preferências de notificação)
   *   - Pagamento do checkout: o pedido { id: 'ORDE_…', reference_id, charges[] }
   *   - Checkout: { id: 'CHEC_…', status: 'EXPIRED' | 'INACTIVE' }
   */
  async handleWebhook(payload) {
    try {
      return await this.processWebhook(payload);
    } catch (err) {
      // recurso inexistente no PagBank (aviso forjado ou de outra conta): registra e responde 200,
      // senão o PagBank reenviaria para sempre. Outras falhas sobem (5xx) para haver nova tentativa.
      if (err.upstreamStatus !== 404 && err.upstreamStatus !== 400) throw err;
      await recordEvent({ event: String(payload?.event ?? 'unknown').slice(0, 60), resourceId: String(payload?.resource?.id ?? payload?.id ?? '').slice(0, 64) || null, status: 'NOT_FOUND', payload: payload ?? {} });
      return { handled: false, reason: 'recurso não encontrado no PagBank' };
    }
  },

  async processWebhook(payload) {
    const id = String(payload?.resource?.id ?? payload?.id ?? '');

    if (String(payload?.event ?? '').startsWith('subscription.') && id.startsWith('SUBS_')) {
      const remote = await pagbank.getSubscription(id);
      const refId = UUID.test(remote.reference_id ?? '') ? remote.reference_id : null;
      const row = await db('subscriptions')
        .where({ pagbankSubscriptionId: remote.id })
        .orWhere({ pagbankPlanId: remote.plan?.id ?? '' })
        .modify((q) => refId && q.orWhere({ id: refId }))
        .first();
      await recordEvent({ event: payload.event, resourceId: id, subscriptionId: row?.id ?? null, status: remote.status, verified: true, payload });
      if (!row) return { handled: false, reason: 'assinatura desconhecida' };
      await applyRemote(row, remoteChanges(remote));
      return { handled: true };
    }

    if (id.startsWith('ORDE_')) {
      const order = await pagbank.getOrder(id);
      const row = UUID.test(order.reference_id ?? '') ? await db('subscriptions').where({ id: order.reference_id }).first() : null;
      const paid = (order.charges ?? []).some((c) => c.status === 'PAID');
      await recordEvent({ event: 'order', resourceId: id, subscriptionId: row?.id ?? null, status: paid ? 'PAID' : order.charges?.[0]?.status ?? null, verified: true, payload });
      if (!row) return { handled: false, reason: 'pedido sem assinatura' };
      // 1º pagamento aprovado = assinatura ativa; os avisos de assinatura completam os dados depois
      if (paid && OPEN_STATUSES.includes(row.status)) await applyRemote(row, { status: 'active', orderId: id });
      return { handled: true };
    }

    if (id.startsWith('CHEC_')) {
      const checkout = await pagbank.getCheckout(id);
      const row = await db('subscriptions').where({ checkoutId: id }).first();
      await recordEvent({ event: 'checkout', resourceId: id, subscriptionId: row?.id ?? null, status: checkout.status, verified: true, payload });
      if (row?.status === 'checkout' && ['EXPIRED', 'INACTIVE'].includes(checkout.status)) {
        await applyRemote(row, { status: 'checkout_expired' });
      }
      return { handled: Boolean(row) };
    }

    await recordEvent({ event: String(payload?.event ?? 'unknown').slice(0, 60), resourceId: id.slice(0, 64) || null, payload: payload ?? {} });
    return { handled: false, reason: 'evento ignorado' };
  },

  // Administração: assinaturas de todos os usuários
  async list({ page, pageSize, status, plan }) {
    const q = db('subscriptions as s').join('users as u', 'u.id', 's.userId');
    if (status) q.where('s.status', status);
    if (plan) q.where('s.plan', plan);
    const [[{ total }], data] = await Promise.all([
      q.clone().count({ total: '*' }),
      q
        .clone()
        .select(...COLUMNS.map((c) => `s.${c}`), 'u.email', 's.userId', 's.pagbankSubscriptionId')
        .orderBy('s.createdAt', 'desc')
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);
    return { data, page, pageSize, total: Number(total) };
  },
};
