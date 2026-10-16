import crypto from 'node:crypto';
import { env } from '#config/env.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';

// PagBank: Checkout e Pedidos (api.pagseguro.com) e Pagamentos Recorrentes (api.assinaturas.pagseguro.com).
// O mesmo token vale para as duas APIs; sandbox e produção têm tokens diferentes.
const HOSTS = {
  sandbox: { api: 'https://sandbox.api.pagseguro.com', subscriptions: 'https://sandbox.api.assinaturas.pagseguro.com' },
  production: { api: 'https://api.pagseguro.com', subscriptions: 'https://api.assinaturas.pagseguro.com' },
};
const TIMEOUT_MS = 20_000;

export const pagbankEnabled = () => Boolean(env.PAGBANK_TOKEN);

// Mensagem legível a partir de error_messages[] do PagBank
const describe = (data) =>
  (data?.error_messages ?? [])
    .map((e) => [e.parameter_name, e.description ?? e.message].filter(Boolean).join(': '))
    .join('; ') || data?.message;

async function call(host, path, { method = 'GET', body, query, idempotencyKey } = {}) {
  if (!pagbankEnabled()) throw new AppError('Pagamentos não configurados', 503);
  const url = new URL(path, HOSTS[env.PAGBANK_ENV][host]);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${env.PAGBANK_TOKEN}`,
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(idempotencyKey && { 'x-idempotency-key': idempotencyKey }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.error({ err, method, path }, 'PagBank indisponível');
    throw new AppError('Não foi possível falar com o PagBank; tente de novo em instantes', 502);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // página HTML do firewall (ex.: URL local no corpo) em vez de JSON
    data = { message: /<html/i.test(text) ? 'requisição bloqueada pelo firewall do PagBank' : text.slice(0, 300) };
  }
  // LOG_LEVEL=debug: requisição e resposta completas (sem o token), como a homologação do PagBank pede
  logger.debug({ pagbank: { env: env.PAGBANK_ENV, method, url: url.href, request: body ?? null, status: res.status, response: data } }, 'PagBank');
  if (!res.ok) {
    logger.warn({ status: res.status, method, path, data }, 'PagBank recusou a requisição');
    const err = new AppError(`PagBank: ${describe(data) ?? `erro ${res.status}`}`, 502);
    err.upstreamStatus = res.status;
    throw err;
  }
  return data;
}

export const pagbank = {
  // Checkout Recorrente: o cliente paga na página do PagBank e a assinatura nasce do 1º pagamento
  createCheckout: (body, idempotencyKey) => call('api', '/checkouts', { method: 'POST', body, idempotencyKey }),
  getCheckout: (id) => call('api', `/checkouts/${encodeURIComponent(id)}`),
  inactivateCheckout: (id) => call('api', `/checkouts/${encodeURIComponent(id)}/inactivate`, { method: 'POST' }),
  getOrder: (id) => call('api', `/orders/${encodeURIComponent(id)}`),

  getSubscription: (id) => call('subscriptions', `/subscriptions/${encodeURIComponent(id)}`),
  // q: nome, e-mail ou CPF do assinante
  listSubscriptions: (query) => call('subscriptions', '/subscriptions', { query }),
  cancelSubscription: (id) =>
    call('subscriptions', `/subscriptions/${encodeURIComponent(id)}/cancel`, {
      method: 'PUT',
      idempotencyKey: `cancel${id.replace(/\W/g, '')}`.slice(0, 64),
    }),
  // Faturas e pagamentos da assinatura (estorno do arrependimento)
  listInvoices: (subscriptionId) => call('subscriptions', `/subscriptions/${encodeURIComponent(subscriptionId)}/invoices`),
  listInvoicePayments: (invoiceId) => call('subscriptions', `/invoices/${encodeURIComponent(invoiceId)}/payments`),
  // estorno total (a API de recorrência ainda não faz estorno parcial)
  refundPayment: (paymentId, amount) =>
    call('subscriptions', `/payments/${encodeURIComponent(paymentId)}/refunds`, {
      method: 'POST',
      body: { amount: { value: amount.value, currency: amount.currency ?? 'BRL' } },
      idempotencyKey: `refund${paymentId.replace(/\W/g, '')}`.slice(0, 64),
    }),
  // URL dos webhooks de assinaturas (vale para a conta toda; ver scripts/pagbank-webhook.js)
  setNotificationPreferences: (body) => call('subscriptions', '/preferences/notifications', { method: 'PUT', body }),
  getNotificationPreferences: () => call('subscriptions', '/preferences/notifications'),
};

// Assinatura das notificações: x-authenticity-token = sha256("{token}-{corpo bruto}")
export function verifyAuthenticity(rawBody, signature, token = env.PAGBANK_TOKEN) {
  if (!rawBody || !signature || !token) return false;
  const expected = crypto.createHash('sha256').update(`${token}-${rawBody}`).digest('hex');
  const given = String(signature).trim().toLowerCase();
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
