import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { validate } from '#middlewares/validate.js';
import { updateProfileSchema } from './profiles.schemas.js';
import { profilesService } from './profiles.service.js';

const router = Router();
router.use(authenticate);

router.get('/me', async (req, res) => res.json(await profilesService.get(req.user.id)));
router.patch('/me', validate({ body: updateProfileSchema }), async (req, res) =>
  res.json(await profilesService.update(req.user.id, req.validated.body)),
);

export default router;
