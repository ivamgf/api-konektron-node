import { z } from 'zod';
import { PAID_PLANS } from '#config/plans.js';

export const subscribeSchema = z.object({
  plan: z.enum(PAID_PLANS).describe('Plano pago escolhido'),
  // exigido pelo Asaas para emitir a cobrança (só os dígitos são guardados)
  cpfCnpj: z.string().trim().min(11).max(20).describe('CPF ou CNPJ do pagador'),
  // aceite dos Termos de Uso e da cobrança mensal recorrente, marcado pelo usuário
  acceptTerms: z.literal(true, { error: 'É preciso aceitar os termos e a cobrança recorrente' }),
});
