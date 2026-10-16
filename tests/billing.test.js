import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  buildCheckoutPayload, billingService, effectivePlan, endOfPaidPeriod, hasAccess, inWithdrawalPeriod, isPublicUrl, toLocalStatus,
} from '#modules/billing/billing.service.js';
import { checkoutSchema } from '#modules/billing/billing.schemas.js';
import { pagbankEnabled, verifyAuthenticity } from '#services/pagbank.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const id = '6a45813f-2d11-4a4b-a91c-8cfe49862858';

test('plano efetivo: o maior entre as assinaturas que dão acesso', () => {
  assert.equal(effectivePlan([]), 'free');
  assert.equal(effectivePlan([{ plan: 'master', status: 'canceled' }, { plan: 'standard', status: 'checkout' }]), 'free');
  assert.equal(effectivePlan([{ plan: 'standard', status: 'active' }]), 'standard');
  const paid = '2026-10-01T00:00:00Z';
  assert.equal(effectivePlan([{ plan: 'standard', status: 'active' }, { plan: 'master', status: 'overdue', activatedAt: paid }]), 'master');
  // retentativas de quem já pagou mantêm o acesso; suspensa não
  assert.equal(effectivePlan([{ plan: 'master', status: 'pending_action', activatedAt: paid }]), 'master');
  // 1º pagamento recusado: o PagBank cria a assinatura já em OVERDUE (visto no sandbox) e isso não libera nada
  assert.equal(effectivePlan([{ plan: 'master', status: 'overdue', activatedAt: null }]), 'free');
  assert.equal(effectivePlan([{ plan: 'master', status: 'pending_action' }]), 'free');
  assert.equal(effectivePlan([{ plan: 'master', status: 'suspended' }]), 'free');
});

test('cancelamento: arrependimento em 7 dias e acesso até o fim do período pago', () => {
  const now = new Date('2026-10-20T12:00:00-03:00');
  assert.ok(inWithdrawalPeriod({ activatedAt: '2026-10-14T12:00:00-03:00' }, now));
  assert.ok(!inWithdrawalPeriod({ activatedAt: '2026-10-12T12:00:00-03:00' }, now));
  assert.ok(!inWithdrawalPeriod({ activatedAt: null }, now), 'sem pagamento não há o que estornar');
  assert.equal(endOfPaidPeriod('2026-11-15').toISOString(), '2026-11-15T03:00:00.000Z');
  assert.equal(endOfPaidPeriod(null), null);
  assert.ok(hasAccess({ status: 'canceled', accessUntil: '2026-11-15T03:00:00Z' }, now));
  assert.ok(!hasAccess({ status: 'canceled', accessUntil: '2026-10-19T03:00:00Z' }, now));
  assert.ok(!hasAccess({ status: 'canceled', accessUntil: null }, now));
  // usado direto em filter/find: o índice do array não pode virar a data de referência
  assert.equal(effectivePlan([{ plan: 'master', status: 'canceled', accessUntil: '2026-01-01T00:00:00Z' }]), 'free');
});

test('status do PagBank viram minúsculas', () => {
  assert.equal(toLocalStatus('PENDING_ACTION'), 'pending_action');
  assert.equal(toLocalStatus(undefined), null);
});

test('checkout recorrente: mensal, só cartão, sem fim e com retorno ao app', () => {
  const body = buildCheckoutPayload({ id, plan: 'master', amount: 9990, expiresAt: new Date('2026-10-15T15:00:00.123Z') });
  assert.equal(body.reference_id, id);
  assert.deepEqual(body.items, [{ reference_id: 'master', name: 'KonekTron Master (mensal)', quantity: 1, unit_amount: 9990 }]);
  assert.deepEqual(body.payment_methods, [{ type: 'CREDIT_CARD' }]);
  assert.deepEqual(body.recurrence_plan.interval, { unit: 'MONTH', length: 1 });
  assert.ok(!('billing_cycles' in body.recurrence_plan), 'sem billing_cycles a assinatura não expira');
  assert.equal(body.expiration_date, '2026-10-15T15:00:00+00:00');
  // APP_URL local (testes/desenvolvimento): o firewall do PagBank recusaria a URL, então ela não vai
  if (isPublicUrl(process.env.APP_URL)) assert.match(body.redirect_url, new RegExp(`/billing/return\\?ref=${id}$`));
  else assert.ok(!('redirect_url' in body) && !('return_url' in body));
  assert.ok(body.soft_descriptor.length <= 17);
});

test('URLs públicas: o PagBank bloqueia endereços locais', () => {
  assert.ok(isPublicUrl('https://www.konektron.orkneytech.com.br'));
  assert.ok(isPublicUrl('http://app.exemplo.com'));
  assert.ok(!isPublicUrl('http://app.exemplo.com', { httpsOnly: true }));
  for (const u of ['http://localhost:5173', 'http://127.0.0.1:3333', 'http://192.168.0.10', 'http://10.0.0.2', 'nada']) assert.ok(!isPublicUrl(u), u);
});

test('só planos pagos podem ser assinados', () => {
  assert.equal(checkoutSchema.safeParse({ plan: 'standard', acceptTerms: true }).success, true);
  assert.equal(checkoutSchema.safeParse({ plan: 'free', acceptTerms: true }).success, false);
  // aceite explícito dos termos e da cobrança recorrente
  assert.equal(checkoutSchema.safeParse({ plan: 'standard' }).success, false);
  assert.equal(checkoutSchema.safeParse({ plan: 'standard', acceptTerms: false }).success, false);
});

test('assinatura da notificação: sha256 de "token-corpo"', () => {
  const raw = '{"id":"ORDE_1","charges":[]}';
  const sig = crypto.createHash('sha256').update(`tok-${raw}`).digest('hex');
  assert.ok(verifyAuthenticity(raw, sig, 'tok'));
  assert.ok(verifyAuthenticity(raw, sig.toUpperCase(), 'tok'));
  assert.ok(!verifyAuthenticity(`${raw} `, sig, 'tok'), 'corpo alterado');
  assert.ok(!verifyAuthenticity(raw, sig, 'outro'));
  assert.ok(!verifyAuthenticity(raw, 'curta', 'tok'));
  assert.ok(!verifyAuthenticity(undefined, sig, 'tok'));
});

test('aviso forjado não muda nada sem conferir no PagBank', { skip: pagbankEnabled() && 'PAGBANK_TOKEN definido' }, async () => {
  await assert.rejects(
    billingService.handleWebhook({ event: 'subscription.activated', resource: { id: 'SUBS_X', status: 'ACTIVE', reference_id: id } }),
    (err) => err.statusCode === 503,
  );
  await assert.rejects(billingService.handleWebhook({ id: 'ORDE_X', reference_id: id, charges: [{ status: 'PAID' }] }), (err) => err.statusCode === 503);
});

test('OpenAPI documenta as assinaturas', () => {
  const { paths } = buildOpenApi();
  assert.deepEqual(paths['/billing/plans'].get.security, []);
  assert.deepEqual(paths['/billing/webhooks/pagbank'].post.security, []);
  assert.ok(paths['/billing/checkout'].post.responses[201]);
  assert.ok(paths['/billing/subscriptions/{id}/refresh'].post);
  assert.ok(paths['/admin/subscriptions'].get);
});
