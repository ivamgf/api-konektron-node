import { Router } from 'express';
import pkg from '../package.json' with { type: 'json' };
import { env } from '#config/env.js';
import { db } from '#database/connection.js';
import docsRoutes from './docs/docs.routes.js';
import authRoutes from '#modules/auth/auth.routes.js';
import profileRoutes from '#modules/profiles/profiles.routes.js';
import addressRoutes from '#modules/addresses/addresses.routes.js';
import userRoutes from '#modules/users/users.routes.js';
import logRoutes from '#modules/logs/logs.routes.js';
import projectRoutes from '#modules/projects/projects.routes.js';
import engineeringRoutes from '#modules/engineering/engineering.routes.js';
import { contactAdminRouter, contactRouter } from '#modules/contact/contact.routes.js';
import billingRoutes, { billingAdminRouter } from '#modules/billing/billing.routes.js';

const router = Router();
const docsEnabled = env.DOCS_ENABLED === 'true';

// Raiz da API: o que é e por onde começar
router.get('/', (req, res) => {
  const base = req.baseUrl;
  res.json({
    name: 'KonekTron API',
    version: pkg.version,
    health: `${base}/health`,
    ...(docsEnabled && { docs: `${base}/docs/`, openapi: `${base}/docs/openapi.json` }),
  });
});

router.get('/health', async (_req, res) => {
  const base = { version: pkg.version, uptime: Math.round(process.uptime()), node: process.version };
  try {
    await db.raw('select 1');
    res.json({ status: 'ok', db: 'up', ...base });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down', ...base });
  }
});

router.use('/auth', authRoutes);
router.use('/profiles', profileRoutes);
router.use('/addresses', addressRoutes);
router.use('/admin/users', userRoutes);
router.use('/admin/logs', logRoutes);
router.use('/admin/contact-messages', contactAdminRouter);
router.use('/admin/subscriptions', billingAdminRouter);
router.use('/contact', contactRouter);
router.use('/billing', billingRoutes);
router.use('/projects', projectRoutes);
router.use('/engineering', engineeringRoutes);
if (docsEnabled) router.use('/docs', docsRoutes);

export default router;
