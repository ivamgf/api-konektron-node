import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { requireRole } from '#middlewares/authorize.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { idParams } from '#shared/schemas.js';
import { adminUpdateSchema, listQuery } from './users.schemas.js';
import { usersService as s } from './users.service.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/', validate({ query: listQuery }), async (req, res) =>
  res.json(await s.list(req.validated.query)),
);

router.get('/:id', validate({ params: idParams }), async (req, res) =>
  res.json(await s.get(req.validated.params.id)),
);

router.patch('/:id', validate({ params: idParams, body: adminUpdateSchema }), async (req, res) => {
  const user = await s.update(req.validated.params.id, req.validated.body, req.user.id);
  await audit({ userId: req.user.id, action: 'admin.user_update', description: user.id, req });
  res.json(user);
});

router.delete('/:id', validate({ params: idParams }), async (req, res) => {
  await s.remove(req.validated.params.id, req.user.id);
  await audit({ userId: req.user.id, action: 'admin.user_delete', description: req.validated.params.id, req });
  res.status(204).end();
});

export default router;
