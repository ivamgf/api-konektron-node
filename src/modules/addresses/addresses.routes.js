import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { crudRouter } from '#shared/crudRouter.js';
import { addressSchema } from './addresses.schemas.js';

const router = Router();
router.use(authenticate);
router.use(
  '/',
  crudRouter({
    table: 'addresses',
    label: 'Endereço',
    scope: (req) => ({ userId: req.user.id }),
    createSchema: addressSchema,
    // Garante um único endereço principal por usuário
    beforeWrite: async (trx, req, data) => {
      if (data.isPrimary) {
        await trx('addresses').where({ userId: req.user.id, isPrimary: true }).update({ isPrimary: false });
      }
    },
  }),
);

export default router;
