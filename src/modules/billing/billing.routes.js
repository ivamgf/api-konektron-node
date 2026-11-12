import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '#config/env.js';
import { authenticate } from '#middlewares/authenticate.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { AppError } from '#utils/AppError.js';
import { billingService } from './billing.service.js';
import { subscribeSchema } from './billing.schemas.js';

// Assinaturas mensais dos planos Standard e Master pelo Asaas
const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
});

// O Asaas manda o token cadastrado no webhook no header asaas-access-token
export function webhookTokenMatches(received, expected = env.ASAAS_WEBHOOK_TOKEN) {
  if (!expected || !received) return false;
  const a = Buffer.from(String(received));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Público: planos, preços e seções (a página de planos e a home)
router.get('/plans', (_req, res) => res.json(billingService.catalog()));

// Avisos do Asaas (sem login, autenticados pelo token do webhook)
router.post('/webhooks/asaas', async (req, res) => {
  if (!webhookTokenMatches(req.get('asaas-access-token'))) throw new AppError('Token do webhook inválido', 401);
  const result = await billingService.handleWebhook(req.body);
  req.log?.info({ event: req.body?.event, id: req.body?.id, ...result }, 'Aviso do Asaas');
  res.json({ received: true });
});

router.get('/subscription', authenticate, async (req, res) => res.json(await billingService.overview(req.user.id)));

// Assina (ou troca de plano) e devolve o link da fatura no Asaas
router.post('/subscribe', authenticate, limiter, validate({ body: subscribeSchema }), async (req, res) => {
  const { plan, cpfCnpj } = req.validated.body;
  const result = await billingService.subscribe(req.user.id, { plan, cpfCnpj });
  await audit({ userId: req.user.id, action: 'billing.subscribe', description: `${plan}; termos e cobrança recorrente aceitos`, req });
  res.status(201).json(result);
});

// Confere os pagamentos no Asaas sem esperar o webhook (volta da fatura)
router.post('/subscription/refresh', authenticate, limiter, async (req, res) => res.json(await billingService.refresh(req.user.id)));

router.post('/subscription/cancel', authenticate, limiter, async (req, res) => {
  const result = await billingService.cancel(req.user.id);
  const refund = result.withdrawal ? `; arrependimento, estorno ${result.refund?.requested ? 'solicitado' : 'pendente'}` : '';
  await audit({ userId: req.user.id, action: 'billing.cancel', description: `${result.subscription.plan}${refund}`, req });
  res.json(result);
});

export default router;
