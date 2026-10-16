import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '#config/env.js';
import { authenticate } from '#middlewares/authenticate.js';
import { requireRole } from '#middlewares/authorize.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { verifyAuthenticity } from '#services/pagbank.js';
import { idParams } from '#shared/schemas.js';
import { AppError } from '#utils/AppError.js';
import { billingService } from './billing.service.js';
import * as s from './billing.schemas.js';

// Assinaturas mensais pelo Checkout Recorrente do PagBank
const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
});

// Público: planos à venda e preços (a página inicial mostra a mensalidade)
router.get('/plans', (_req, res) => res.json(billingService.catalog()));

// Notificações do PagBank (sem login). Se vier x-authenticity-token, ele precisa bater;
// de todo modo o estado é relido na API do PagBank antes de mudar qualquer plano.
router.post('/webhooks/pagbank', async (req, res) => {
  const signature = req.get('x-authenticity-token');
  if (signature && !verifyAuthenticity(req.rawBody, signature)) {
    req.log?.warn('Notificação do PagBank com assinatura inválida');
    throw new AppError('Assinatura inválida', 401);
  }
  const result = await billingService.handleWebhook(req.body);
  req.log?.info({ event: req.body?.event, id: req.body?.resource?.id ?? req.body?.id, ...result }, 'Notificação do PagBank');
  res.status(200).json({ received: true });
});

router.get('/subscription', authenticate, async (req, res) => {
  res.json(await billingService.overview(req.user.id));
});

// Escolheu o plano: cria o checkout e devolve o link para onde o app redireciona
router.post('/checkout', authenticate, limiter, validate({ body: s.checkoutSchema }), async (req, res) => {
  const result = await billingService.createCheckout(req.user.id, req.validated.body.plan);
  await audit({ userId: req.user.id, action: 'billing.checkout', description: `${req.validated.body.plan}; termos e cobrança recorrente aceitos`, req });
  res.status(201).json(result);
});

// Retorno do checkout: confere a situação no PagBank
router.post('/subscriptions/:id/refresh', authenticate, limiter, validate({ params: idParams }), async (req, res) => {
  res.json(await billingService.refresh(req.user.id, req.validated.params.id));
});

router.post('/subscription/cancel', authenticate, limiter, async (req, res) => {
  const result = await billingService.cancel(req.user.id);
  const refund = result.withdrawal ? `; arrependimento, estorno ${result.refund?.requested ? 'solicitado' : 'pendente'}` : '';
  await audit({ userId: req.user.id, action: 'billing.cancel', description: `${result.subscription.plan}${refund}`, req });
  res.json(result);
});

export default router;

// Administração: /admin/subscriptions
export const billingAdminRouter = Router();
billingAdminRouter.use(authenticate, requireRole('admin'));
billingAdminRouter.get('/', validate({ query: s.subscriptionListQuery }), async (req, res) => {
  res.json(await billingService.list(req.validated.query));
});
