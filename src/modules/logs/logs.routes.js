import { Router } from 'express';
import { db } from '#database/connection.js';
import { authenticate } from '#middlewares/authenticate.js';
import { requireRole } from '#middlewares/authorize.js';
import { validate } from '#middlewares/validate.js';
import { listQuery } from './logs.schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', validate({ query: listQuery }), async (req, res) => {
  const { page, pageSize, userId, action, from, to } = req.validated.query;
  const q = db('audit_logs as l')
    .leftJoin('users as u', 'u.id', 'l.userId')
    .select('l.*', 'u.email')
    .orderBy('l.createdAt', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  if (userId) q.where('l.userId', userId);
  if (action) q.where('l.action', action);
  if (from) q.where('l.createdAt', '>=', from);
  if (to) q.where('l.createdAt', '<=', to);
  res.json({ data: await q, page, pageSize });
});

// Resumo para o dashboard do admin (UC005)
router.get('/summary', async (_req, res) => {
  const [[users], byPlan, logins, projects] = await Promise.all([
    db('users').whereNull('deletedAt').count({ total: '*' }),
    db('users').whereNull('deletedAt').select('plan').count({ total: '*' }).groupBy('plan'),
    db('audit_logs')
      .where({ action: 'auth.login' })
      .where('createdAt', '>', db.raw(`now() - interval '30 days'`))
      .select(db.raw(`date_trunc('day', created_at)::date as day`), db.raw('count(*)::int as total'))
      .groupBy('day')
      .orderBy('day'),
    db('projects').whereNull('deletedAt').select('type').count({ total: '*' }).groupBy('type'),
  ]);
  res.json({
    totalUsers: Number(users.total),
    usersByPlan: byPlan.map((r) => ({ plan: r.plan, total: Number(r.total) })),
    projectsByType: projects.map((r) => ({ type: r.type, total: Number(r.total) })),
    loginsLast30Days: logins,
  });
});

export default router;
