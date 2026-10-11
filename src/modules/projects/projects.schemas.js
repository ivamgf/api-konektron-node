import { z } from 'zod';
import { longText, pagination } from '#shared/schemas.js';

export const PROJECT_TYPES = ['software', 'data_analysis'];

export const listQuery = z.object({ ...pagination, type: z.enum(PROJECT_TYPES).optional() });

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(PROJECT_TYPES).optional(),
  description: longText(10_000),
  version: z.string().trim().max(20).optional(),
});

// O tipo não muda depois de criado (os artefatos dependem dele)
export const updateProjectSchema = createProjectSchema.omit({ type: true }).partial();
