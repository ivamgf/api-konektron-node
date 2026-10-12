import { z } from 'zod';
import { PLANS, ROLES } from '#config/plans.js';
import { pagination } from '#shared/schemas.js';

const role = z.enum(Object.values(ROLES));
const plan = z.enum(Object.values(PLANS));

export const listQuery = z.object({
  ...pagination,
  search: z.string().trim().max(200).optional(),
  role: role.optional(),
  plan: plan.optional(),
});

// RF5.1 - Editar usuário
export const adminUpdateSchema = z.object({
  role: role.optional(),
  plan: plan.optional(),
  isActive: z.boolean().optional(),
});
