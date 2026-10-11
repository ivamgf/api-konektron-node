import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '#middlewares/authenticate.js';
import { crudRouter } from '#shared/crudRouter.js';
import { optText } from '#shared/schemas.js';

const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  number: optText(20),
  complement: optText(200),
  district: optText(200),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(2).max(50),
  postalCode: optText(20),
  country: z.string().length(2).toUpperCase().optional(),
  isPrimary: z.boolean().optional(),
});

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
