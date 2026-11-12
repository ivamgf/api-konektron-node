import { z } from 'zod';
import { longText, pagination } from '#shared/schemas.js';

export const PROJECT_TYPES = ['software', 'data_analysis'];
// project: o projeto inteiro (nas seções que os planos do dono e do participante incluem); kanban: só o Kanban
export const MEMBER_ACCESS = ['project', 'kanban'];

export const listQuery = z.object({
  ...pagination,
  type: z.enum(PROJECT_TYPES).optional(),
  scope: z.enum(['all', 'owned', 'shared']).optional().describe('Meus projetos, compartilhados comigo ou todos (padrão)'),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(PROJECT_TYPES).optional(),
  description: longText(10_000),
  version: z.string().trim().max(20).optional(),
});

// O tipo não muda depois de criado (os artefatos dependem dele)
export const updateProjectSchema = createProjectSchema.omit({ type: true }).partial();

export const addMemberSchema = z.object({
  email: z.email({ error: 'E-mail inválido' }).max(255).transform((s) => s.trim().toLowerCase()),
  access: z.enum(MEMBER_ACCESS).optional().default('project'),
});

export const updateMemberSchema = z.object({ access: z.enum(MEMBER_ACCESS) });

export const memberParams = z.object({ projectId: z.uuid(), memberId: z.uuid() });
