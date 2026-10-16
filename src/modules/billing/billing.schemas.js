import { z } from 'zod';
import { PAID_PLANS, PLANS } from '#config/plans.js';
import { pagination } from '#shared/schemas.js';

export const SUBSCRIPTION_STATUS = [
  'checkout', 'checkout_expired', 'pending', 'trial', 'active', 'overdue', 'pending_action', 'suspended', 'canceled', 'expired',
];

export const checkoutSchema = z.object({
  plan: z.enum(PAID_PLANS).describe('Plano pago escolhido'),
  // aceite dos Termos de Uso e da cobrança mensal recorrente, marcado pelo usuário no checkout
  acceptTerms: z.literal(true, { error: 'É preciso aceitar os termos e a cobrança recorrente' }),
});

export const subscriptionListQuery = z.object({
  ...pagination,
  status: z.enum(SUBSCRIPTION_STATUS).optional(),
  plan: z.enum([PLANS.STANDARD, PLANS.MASTER]).optional(),
});
