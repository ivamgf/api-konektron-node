import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asaasDate, validCpfCnpj } from '#services/asaas.js';
import { webhookTokenMatches } from '#modules/billing/billing.routes.js';
import { subscribeSchema } from '#modules/billing/billing.schemas.js';
import {
  catalog, effectivePlan, hasAccess, inWithdrawalPeriod, periodEnd, summarize,
} from '#modules/billing/billing.service.js';

const DAY = 86_400_000;
const now = new Date('2026-11-11T15:00:00-03:00');

test('CPF e CNPJ com dígitos verificadores', () => {
  assert.ok(validCpfCnpj('529.982.247-25'));
  assert.ok(validCpfCnpj('11.222.333/0001-81'));
  assert.ok(!validCpfCnpj('529.982.247-26'));
  assert.ok(!validCpfCnpj('111.111.111-11'));
  assert.ok(!validCpfCnpj('123'));
});

test('data do Asaas no fuso de Brasília', () => {
  assert.equal(asaasDate(new Date('2026-11-12T01:30:00Z')), '2026-11-11');
});

test('período pago: até o mesmo dia do mês seguinte (fim de mês ajustado)', () => {
  assert.equal(periodEnd('2026-11-11').toISOString(), '2026-12-11T03:00:00.000Z');
  assert.equal(periodEnd('2026-01-31').toISOString(), '2026-02-28T03:00:00.000Z');
  assert.equal(periodEnd('2026-12-15').toISOString(), '2027-01-15T03:00:00.000Z');
});

test('assinatura: pendente, ativa, em atraso e cancelada', () => {
  const sub = { status: 'pending' };
  assert.equal(summarize(sub, [{ status: 'PENDING', dueDate: '2026-11-11' }], now).status, 'pending');
  const paid = [{ status: 'RECEIVED', dueDate: '2026-11-11', paidAt: now }];
  const active = summarize(sub, paid, now);
  assert.equal(active.status, 'active');
  assert.equal(active.paidUntil.toISOString(), '2026-12-11T03:00:00.000Z');
  assert.ok(active.activatedAt);
  // mês seguinte sem pagamento
  const later = new Date('2026-12-13T12:00:00-03:00');
  assert.equal(summarize(sub, [...paid, { status: 'OVERDUE', dueDate: '2026-12-11' }], later).status, 'overdue');
  assert.equal(summarize({ status: 'canceled' }, paid, now).status, 'canceled');
  // estorno: o pagamento deixa de contar
  assert.equal(summarize(sub, [{ status: 'REFUNDED', dueDate: '2026-11-11' }], now).paidUntil, null);
});

test('acesso: tolerância no atraso e fim do período na cancelada', () => {
  const paidUntil = new Date(now.getTime() - 2 * DAY);
  assert.ok(hasAccess({ status: 'overdue', paidUntil }, now, 5));
  assert.ok(!hasAccess({ status: 'overdue', paidUntil }, now, 1));
  assert.ok(!hasAccess({ status: 'canceled', paidUntil }, now, 5));
  assert.ok(hasAccess({ status: 'canceled', paidUntil: new Date(now.getTime() + DAY) }, now, 5));
  assert.ok(!hasAccess({ status: 'pending', paidUntil: null }, now, 5));
});

test('plano efetivo: o maior com acesso; sem nenhum, Free', () => {
  const future = new Date(now.getTime() + 10 * DAY);
  assert.equal(effectivePlan([], now), 'free');
  assert.equal(effectivePlan([{ plan: 'standard', status: 'active', paidUntil: future }], now), 'standard');
  // troca para menor: o Master cancelado vale até o fim do período pago
  assert.equal(
    effectivePlan([
      { plan: 'master', status: 'canceled', paidUntil: future },
      { plan: 'standard', status: 'pending', paidUntil: null },
    ], now),
    'master',
  );
  assert.equal(effectivePlan([{ plan: 'master', status: 'pending', paidUntil: null }], now), 'free');
});

test('arrependimento: 7 dias do 1º pagamento', () => {
  assert.ok(inWithdrawalPeriod({ activatedAt: new Date(now.getTime() - 6 * DAY) }, now));
  assert.ok(!inWithdrawalPeriod({ activatedAt: new Date(now.getTime() - 8 * DAY) }, now));
  assert.ok(!inWithdrawalPeriod({ activatedAt: null }, now));
});

test('catálogo: três planos com preço, seções e IA', () => {
  const c = catalog();
  assert.deepEqual(c.plans.map((p) => [p.plan, p.amount]), [['free', 0], ['standard', 7990], ['master', 17900]]);
  assert.ok(c.plans.every((p) => p.ai));
  assert.equal(c.plans[0].projectLimit, 3);
});

test('assinar exige plano pago, CPF/CNPJ e aceite', () => {
  assert.equal(subscribeSchema.safeParse({ plan: 'standard', cpfCnpj: '52998224725', acceptTerms: true }).success, true);
  assert.equal(subscribeSchema.safeParse({ plan: 'free', cpfCnpj: '52998224725', acceptTerms: true }).success, false);
  assert.equal(subscribeSchema.safeParse({ plan: 'master', cpfCnpj: '52998224725', acceptTerms: false }).success, false);
});

test('token do webhook: comparação exata', () => {
  const token = 'a'.repeat(40);
  assert.ok(webhookTokenMatches(token, token));
  assert.ok(!webhookTokenMatches('b'.repeat(40), token));
  assert.ok(!webhookTokenMatches(undefined, token));
  assert.ok(!webhookTokenMatches(token, undefined));
});

test('chave do Asaas precisa ser do ambiente da URL', async () => {
  const { asaasKeyMatchesUrl } = await import('#config/env.js');
  assert.ok(asaasKeyMatchesUrl('$aact_prod_abc', 'https://api.asaas.com/v3'));
  assert.ok(!asaasKeyMatchesUrl('$aact_prod_abc', 'https://api-sandbox.asaas.com/v3'));
  assert.ok(asaasKeyMatchesUrl('$aact_hmlg_abc', 'https://api-sandbox.asaas.com/v3'));
  assert.ok(!asaasKeyMatchesUrl('$aact_hmlg_abc', 'https://api.asaas.com/v3'));
});
