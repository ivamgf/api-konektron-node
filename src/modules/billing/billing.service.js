import { env } from '#config/env.js';
import {
  FREE_INACTIVE_MONTHS, FREE_PROJECT_LIMIT, PAID_PLANS, PLAN_PRICES, PLAN_SECTIONS, PLANS, planRank, ROLES,
} from '#config/plans.js';
import { db } from '#database/connection.js';
import {
  asaas, asaasDate, asaasEnabled, asaasSandbox, EXTERNAL_PREFIX, toAppError, validCpfCnpj,
} from '#services/asaas.js';
import { escapeHtml, sendMail } from '#services/mailer.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';

/**
 * Assinaturas mensais dos planos Standard e Master pelo Asaas.
 *
 * 1. POST /billing/subscribe cria (ou reaproveita) o cliente no Asaas e a assinatura com forma de pagamento
 *    livre (Pix, boleto ou cartão, escolhida na fatura) e devolve o link da fatura.
 * 2. O Asaas avisa os pagamentos em POST /billing/webhooks/asaas (ou o app pede POST /billing/subscription/refresh).
 *    Cada pagamento confirmado cobre um mês a partir do vencimento (paid_until).
 * 3. O plano do usuário é o maior entre as assinaturas com acesso; sem nenhuma, Free. Atraso além de
 *    ASAAS_TOLERANCE_DAYS ou assinatura cancelada com o período pago vencido voltam a conta ao Free.
 */

const PLAN_NAMES = { [PLANS.FREE]: 'Free', [PLANS.STANDARD]: 'Standard', [PLANS.MASTER]: 'Master' };
export const PAID_STATUSES = Object.freeze(['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED']);
const OPEN_PAYMENT_STATUSES = ['PENDING', 'OVERDUE', 'AWAITING_RISK_ANALYSIS'];
// Assinatura ainda viva no Asaas (no máximo uma por usuário)
export const OPEN_STATUSES = Object.freeze(['pending', 'active', 'overdue']);
// Direito de arrependimento (CDC art. 49): 7 dias a contar do 1º pagamento, com devolução integral
export const WITHDRAWAL_DAYS = 7;
const DAY = 86_400_000;

// Administradores e contas Master vitalícias nunca são cobrados nem rebaixados pela assinatura
export const isExempt = (user) => user?.role === ROLES.ADMIN || Boolean(user?.lifetime);

const description = (plan) => `KonekTron: plano ${PLAN_NAMES[plan]} (mensal)`;
const toCents = (value) => Math.round(Number(value) * 100);

/** Fim do período pago por uma cobrança que vence em `dueDate` (AAAA-MM-DD): o mesmo dia do mês seguinte */
export function periodEnd(dueDate, months = 1) {
  const [y, m, d] = String(dueDate).slice(0, 10).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  const day = Math.min(d, lastDay);
  return new Date(`${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-${pad(day)}T00:00:00-03:00`);
}

/** A assinatura dá acesso ao plano? Em atraso, só dentro da tolerância; cancelada, até o fim do período pago. */
export function hasAccess(sub, now = new Date(), toleranceDays = env.ASAAS_TOLERANCE_DAYS) {
  if (!sub?.paidUntil) return false;
  const until = new Date(sub.paidUntil).getTime();
  if (sub.status === 'canceled') return until > now.getTime();
  if (!OPEN_STATUSES.includes(sub.status)) return false;
  return until + toleranceDays * DAY > now.getTime();
}

/** Plano que o usuário deve ter: o maior entre as assinaturas com acesso; sem nenhuma, Free */
export function effectivePlan(subs, now = new Date(), toleranceDays = env.ASAAS_TOLERANCE_DAYS) {
  return subs
    .filter((s) => hasAccess(s, now, toleranceDays))
    .reduce((best, s) => (planRank(s.plan) > planRank(best) ? s.plan : best), PLANS.FREE);
}

/** Estado da assinatura a partir das cobranças espelhadas do Asaas */
export function summarize(sub, payments, now = new Date()) {
  const paid = payments.filter((p) => PAID_STATUSES.includes(p.status));
  const paidUntil = paid.length ? new Date(Math.max(...paid.map((p) => periodEnd(p.dueDate).getTime()))) : null;
  const firstPaidAt = paid.length ? new Date(Math.min(...paid.map((p) => new Date(p.paidAt ?? now).getTime()))) : null;
  const open = payments.filter((p) => OPEN_PAYMENT_STATUSES.includes(p.status)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  let status;
  if (sub.status === 'canceled') status = 'canceled';
  else if (paidUntil && paidUntil > now) status = 'active';
  else if (paidUntil || payments.some((p) => p.status === 'OVERDUE')) status = 'overdue';
  else status = 'pending';
  return {
    status,
    // arrependimento: o acesso terminou no cancelamento, mesmo que o estorno ainda não tenha sido refletido
    paidUntil: sub.refundedAt ? new Date(sub.refundedAt) : paidUntil,
    activatedAt: sub.activatedAt ?? firstPaidAt,
    nextDueDate: status === 'canceled' ? null : (open[0]?.dueDate ?? null),
  };
}

export const inWithdrawalPeriod = (sub, now = new Date()) =>
  Boolean(sub?.activatedAt) && now - new Date(sub.activatedAt) <= WITHDRAWAL_DAYS * DAY;

export function catalog() {
  const enabled = asaasEnabled();
  return {
    enabled,
    sandbox: asaasSandbox(),
    currency: 'BRL',
    interval: 'MONTH',
    plans: [PLANS.FREE, ...PAID_PLANS].map((plan) => ({
      plan,
      amount: plan === PLANS.FREE ? 0 : PLAN_PRICES[plan],
      sections: PLAN_SECTIONS[plan],
      ai: true,
      projectLimit: plan === PLANS.FREE ? FREE_PROJECT_LIMIT : null,
      inactiveMonths: plan === PLANS.FREE ? FREE_INACTIVE_MONTHS : null,
    })),
  };
}

// ---------------------------------------------------------------- persistência

const openSubscription = (userId, trx = db) =>
  trx('subscriptions').where({ userId }).whereIn('status', OPEN_STATUSES).orderBy('createdAt', 'desc').first();

function paymentRow(p) {
  const paidOn = p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? null;
  return {
    amount: toCents(p.value),
    status: String(p.status ?? 'PENDING').slice(0, 40),
    billingType: p.billingType ? String(p.billingType).slice(0, 30) : null,
    dueDate: p.dueDate,
    paidAt: paidOn ? new Date(`${String(paidOn).slice(0, 10)}T12:00:00-03:00`) : null,
    invoiceUrl: p.invoiceUrl ? String(p.invoiceUrl).slice(0, 500) : null,
  };
}

async function savePayment(subscriptionId, p) {
  await db('payments')
    .insert({ subscriptionId, asaasPaymentId: p.id, ...paymentRow(p) })
    .onConflict('asaas_payment_id')
    .merge();
}

async function notify(userId, subject, text) {
  const u = await db('users').where({ id: userId }).first('email');
  if (!u) return;
  const link = `${env.APP_URL.replace(/\/$/, '')}/plans`;
  await sendMail({
    to: u.email,
    subject: `KonekTron — ${subject}`,
    html: `<p>${escapeHtml(text)}</p><p><a href="${link}">Ver planos e assinatura</a></p>`,
  }).catch((err) => logger.error({ err, userId }, 'Falha ao enviar e-mail da assinatura'));
}

/**
 * Grava no usuário o plano das assinaturas. Administradores e contas sem nenhuma assinatura (plano
 * definido pela administração) não são alterados.
 */
export async function syncUserPlan(userId, now = new Date()) {
  const user = await db('users').where({ id: userId }).whereNull('deletedAt').first('id', 'role', 'plan', 'lifetime');
  if (!user || isExempt(user)) return user?.plan ?? null;
  const subs = await db('subscriptions').where({ userId }).select('plan', 'status', 'paidUntil');
  if (!subs.length) return user.plan;
  const plan = effectivePlan(subs, now);
  if (plan !== user.plan) {
    await db('users').where({ id: userId }).update({ plan });
    logger.info({ userId, from: user.plan, to: plan }, 'Plano alterado pela assinatura');
    if (planRank(plan) > planRank(user.plan)) {
      await notify(userId, `plano ${PLAN_NAMES[plan]} ativo`, `Pagamento confirmado: seu plano ${PLAN_NAMES[plan]} está ativo.`);
    } else if (plan === PLANS.FREE) {
      await notify(
        userId,
        'sua conta voltou ao plano Free',
        `Sua conta voltou ao plano Free. Os projetos continuam salvos; as seções fora do Free ficam bloqueadas até uma nova assinatura.`,
      );
    }
  }
  return plan;
}

/** Recalcula a assinatura a partir das cobranças gravadas e atualiza o plano do usuário */
export async function recompute(subscriptionId, now = new Date(), { sync = true } = {}) {
  const sub = await db('subscriptions').where({ id: subscriptionId }).first();
  if (!sub) return null;
  const payments = await db('payments').where({ subscriptionId }).select('status', 'dueDate', 'paidAt');
  const state = summarize(sub, payments, now);
  const [updated] = await db('subscriptions').where({ id: sub.id }).update(state).returning('*');
  if (sync) await syncUserPlan(sub.userId, now);
  return updated;
}

async function pullPayments(sub) {
  if (!sub?.asaasSubscriptionId) return;
  for (const p of await asaas.subscriptionPayments(sub.asaasSubscriptionId)) await savePayment(sub.id, p);
}

const openInvoice = (subscriptionId) =>
  db('payments')
    .where({ subscriptionId })
    .whereIn('status', OPEN_PAYMENT_STATUSES)
    .orderBy('dueDate')
    .first('invoiceUrl', 'dueDate', 'amount');

const SUB_COLUMNS = [
  'id', 'plan', 'amount', 'status', 'nextDueDate', 'paidUntil', 'activatedAt', 'canceledAt', 'refundedAt', 'createdAt',
];
const pick = (sub) => sub && Object.fromEntries(SUB_COLUMNS.map((k) => [k, sub[k] ?? null]));

// ---------------------------------------------------------------- casos de uso

export const billingService = {
  catalog,

  async overview(userId) {
    const user = await db('users').where({ id: userId }).first('id', 'role', 'plan', 'lifetime', 'cpfCnpj', 'projectsCreated');
    const current = (await openSubscription(userId)) ?? null;
    // assinatura cancelada que ainda dá acesso (fim do período pago)
    const lastCanceled = current
      ? null
      : await db('subscriptions').where({ userId, status: 'canceled' }).orderBy('canceledAt', 'desc').first();
    const shown = current ?? (hasAccess(lastCanceled) ? lastCanceled : null);
    const payments = await db('payments as p')
      .join('subscriptions as s', 's.id', 'p.subscriptionId')
      .where('s.userId', userId)
      .orderBy('p.dueDate', 'desc')
      .limit(24)
      .select('p.id', 's.plan', 'p.amount', 'p.status', 'p.billingType', 'p.dueDate', 'p.paidAt', 'p.invoiceUrl');
    const invoice = current ? await openInvoice(current.id) : null;
    return {
      ...catalog(),
      plan: user.plan,
      exempt: isExempt(user),
      cpfCnpj: user.cpfCnpj ?? null,
      current: pick(shown),
      openInvoiceUrl: invoice?.invoiceUrl ?? null,
      withdrawal: Boolean(current && current.status === 'active' && inWithdrawalPeriod(current)),
      payments,
    };
  },

  async subscribe(userId, { plan, cpfCnpj: rawDoc }) {
    if (!asaasEnabled()) throw new AppError('A cobrança on-line ainda não está ativa', 503);
    const cpfCnpj = String(rawDoc).replace(/\D/g, '');
    if (!validCpfCnpj(cpfCnpj)) throw new AppError('CPF ou CNPJ inválido', 422, { cpfCnpj: ['CPF ou CNPJ inválido'] });
    const user = await db('users').where({ id: userId }).whereNull('deletedAt').first();
    if (!user) throw AppError.notFound('Usuário');
    if (isExempt(user)) throw new AppError('Sua conta já tem acesso total sem cobrança', 409);

    const current = await openSubscription(userId);
    if (current?.plan === plan) {
      if (current.status === 'pending') {
        // já há uma fatura aberta para este plano: devolve a mesma
        await pullPayments(current).catch((err) => logger.warn({ err }, 'Falha ao reler as cobranças'));
        const invoice = await openInvoice(current.id);
        return { subscription: pick(await recompute(current.id)), invoiceUrl: invoice?.invoiceUrl ?? null };
      }
      throw new AppError(`Você já assina o plano ${PLAN_NAMES[plan]}`, 409);
    }

    const amount = PLAN_PRICES[plan];
    const now = new Date();
    let customerId = user.asaasCustomerId;
    try {
      if (!customerId) {
        const profile = await db('profiles').where({ userId }).first('fullName');
        const customer = await asaas.createCustomer({
          name: profile?.fullName?.trim() || user.email,
          email: user.email,
          cpfCnpj,
          externalReference: `${EXTERNAL_PREFIX}${user.id}`,
        });
        customerId = customer.id;
      } else if (user.cpfCnpj !== cpfCnpj) {
        await asaas.updateCustomer(customerId, { cpfCnpj });
      }
    } catch (err) {
      throw toAppError(err);
    }
    await db('users').where({ id: userId }).update({ asaasCustomerId: customerId, cpfCnpj });

    // Troca para um plano menor com o período atual pago: a nova assinatura começa quando ele termina
    // (o plano maior segue até lá). Nos demais casos, a 1ª cobrança vence hoje.
    const downgrade = current && hasAccess(current, now) && planRank(plan) < planRank(current.plan);
    const nextDueDate = downgrade ? asaasDate(new Date(current.paidUntil)) : asaasDate(now);

    const [row] = await db('subscriptions')
      .insert({ userId, plan, amount, status: 'pending', nextDueDate, termsAcceptedAt: now })
      .returning('*');
    try {
      const remote = await asaas.createSubscription({
        customer: customerId,
        value: amount / 100,
        nextDueDate,
        description: description(plan),
        externalReference: `${EXTERNAL_PREFIX}${row.id}`,
      });
      await db('subscriptions').where({ id: row.id }).update({ asaasSubscriptionId: remote.id });
      row.asaasSubscriptionId = remote.id;
    } catch (err) {
      await db('subscriptions').where({ id: row.id }).del();
      throw toAppError(err);
    }

    // A assinatura anterior para de cobrar; o que já foi pago continua valendo até o fim do período
    if (current) await this.cancelRow(current, { reason: 'troca de plano' });

    await pullPayments(row).catch((err) => logger.warn({ err }, 'Falha ao ler a 1ª cobrança'));
    const updated = await recompute(row.id);
    const invoice = await openInvoice(row.id);
    return { subscription: pick(updated), invoiceUrl: invoice?.invoiceUrl ?? null, startsAt: downgrade ? nextDueDate : null };
  },

  // Relê as cobranças no Asaas (sem esperar o webhook)
  async refresh(userId) {
    const current = await openSubscription(userId);
    if (!current) return this.overview(userId);
    try {
      await pullPayments(current);
    } catch (err) {
      throw toAppError(err);
    }
    await recompute(current.id);
    return this.overview(userId);
  },

  async cancelRow(sub, { reason, endAccessNow = false } = {}) {
    if (sub.asaasSubscriptionId) {
      try {
        await asaas.cancelSubscription(sub.asaasSubscriptionId);
      } catch (err) {
        // já removida no Asaas: segue com o cancelamento local
        if (err?.status !== 404) throw toAppError(err);
      }
    }
    const now = new Date();
    await db('subscriptions')
      .where({ id: sub.id })
      .update({ status: 'canceled', canceledAt: now, ...(endAccessNow && { refundedAt: now, paidUntil: now }) });
    logger.info({ subscriptionId: sub.id, reason }, 'Assinatura cancelada');
    return recompute(sub.id);
  },

  // Cancela a renovação. Em até 7 dias do 1º pagamento (arrependimento), estorna e encerra o acesso já.
  async cancel(userId) {
    const current = await openSubscription(userId);
    if (!current) throw AppError.notFound('Assinatura');
    const paid = await db('payments').where({ subscriptionId: current.id }).whereIn('status', PAID_STATUSES).orderBy('dueDate');
    const withdrawal = current.status === 'active' && paid.length === 1 && inWithdrawalPeriod(current);
    let refund = null;
    if (withdrawal) {
      try {
        await asaas.refundPayment(paid[0].asaasPaymentId);
        refund = { requested: true };
      } catch (err) {
        logger.error({ err, paymentId: paid[0].asaasPaymentId }, 'Falha ao estornar o 1º pagamento');
        refund = { requested: false, failed: true };
      }
    }
    const subscription = await this.cancelRow(current, { reason: withdrawal ? 'arrependimento' : 'pedido do usuário', endAccessNow: withdrawal });
    return { subscription: pick(subscription), withdrawal, refund };
  },

  // Exclusão da conta: nada pode continuar sendo cobrado
  async cancelAllForUser(userId) {
    const open = await db('subscriptions').where({ userId }).whereIn('status', OPEN_STATUSES);
    for (const sub of open) {
      await this.cancelRow(sub, { reason: 'conta excluída' }).catch((err) =>
        logger.error({ err, subscriptionId: sub.id }, 'Falha ao cancelar a assinatura da conta excluída'),
      );
    }
  },

  /**
   * Aviso do Asaas. A conta Asaas pode ser compartilhada com outros sistemas: avisos de assinaturas
   * que não são do KonekTron são ignorados (e respondidos com 200, para a fila do Asaas não parar).
   */
  async handleWebhook(body) {
    const { id, event } = body ?? {};
    if (!id || !event) return { ignored: 'evento sem id ou tipo' };
    const remoteId = body.payment?.subscription ?? (String(event).startsWith('SUBSCRIPTION_') ? body.subscription?.id : null);
    if (!remoteId) return { ignored: 'sem assinatura' };
    const sub = await db('subscriptions').where({ asaasSubscriptionId: remoteId }).first();
    if (!sub) return { ignored: 'assinatura de outro sistema' };

    const inserted = await db('payment_events')
      .insert({ id: String(id).slice(0, 60), event: String(event).slice(0, 60), subscriptionId: sub.id, payload: body })
      .onConflict('id')
      .ignore()
      .returning('id');
    if (!inserted.length) {
      const prev = await db('payment_events').where({ id: String(id).slice(0, 60) }).first('processedAt');
      if (prev?.processedAt) return { duplicate: true };
    }
    try {
      if (body.payment?.id) await savePayment(sub.id, body.payment);
      if ((event === 'SUBSCRIPTION_DELETED' || event === 'SUBSCRIPTION_INACTIVATED') && sub.status !== 'canceled') {
        await db('subscriptions').where({ id: sub.id }).update({ status: 'canceled', canceledAt: new Date() });
      }
      const updated = await recompute(sub.id);
      await db('payment_events').where({ id: String(id).slice(0, 60) }).update({ processedAt: new Date(), error: null });
      return { subscription: sub.id, status: updated.status };
    } catch (err) {
      await db('payment_events').where({ id: String(id).slice(0, 60) }).update({ error: String(err?.message ?? err).slice(0, 500) });
      throw err;
    }
  },

  /** Tarefa periódica: atrasos, fins de período e cancelamentos recentes atualizam o plano */
  async expireAccess(now = new Date()) {
    const subs = await db('subscriptions')
      .where((q) =>
        q.whereIn('status', OPEN_STATUSES).orWhere((c) => c.where({ status: 'canceled' }).where('paidUntil', '>', new Date(now - 60 * DAY))),
      )
      .select('id', 'userId');
    // todas as assinaturas do usuário primeiro, depois o plano (sem trocas intermediárias)
    for (const s of subs) await recompute(s.id, now, { sync: false });
    const users = [...new Set(subs.map((s) => s.userId))];
    for (const userId of users) await syncUserPlan(userId, now);
    return { checked: subs.length, users: users.length };
  },
};
