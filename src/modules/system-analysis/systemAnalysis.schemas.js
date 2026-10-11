import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as C from './systemAnalysis.constants.js';

// Códigos como RF1, RNF7, US12: letras maiúsculas, dígitos, ponto, hífen ou underscore
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{1,20}$/, { error: 'Use até 20 letras, dígitos, ".", "-" ou "_"' });
const title = z.string().trim().min(1).max(200);

export const analysisUpdateSchema = z.object({
  goal: longText(10_000),
  scope: longText(),
  technicalDescription: longText(),
  notes: longText(),
});

export const requirementSchema = z.object({
  code,
  title,
  description: longText(10_000),
  type: z.enum(C.REQUIREMENT_TYPES),
  subType: optText(50),
  priority: z.enum(C.PRIORITIES).nullable().optional(),
  status: z.enum(C.REQUIREMENT_STATUS).optional(),
  technicalDescription: longText(),
});

export const userStorySchema = z.object({
  code,
  title,
  requirementId: z.uuid().nullable().optional(),
  asA: z.string().trim().min(1).max(2000),
  iWant: z.string().trim().min(1).max(5000),
  soThat: longText(5000),
  acceptanceCriteria: longText(10_000),
  storyPoints: z
    .number()
    .int()
    .refine((n) => C.STORY_POINTS.includes(n), {
      error: `Use um destes valores: ${C.STORY_POINTS.join(', ')}`,
    })
    .nullable()
    .optional(),
  priority: z.enum(C.PRIORITIES).nullable().optional(),
  status: z.enum(C.USER_STORY_STATUS).optional(),
});

export const diagramSchema = z.object({
  title,
  type: z.enum(C.DIAGRAM_TYPES),
  description: longText(10_000),
  url: z.url().max(1000).nullable().optional(),
  notation: z.enum(C.DIAGRAM_NOTATIONS).nullable().optional(),
  source: longText(200_000),
});

// Filtros das listagens (GET ?type=functional&status=approved)
export const requirementFilters = z.object({
  type: z.enum(C.REQUIREMENT_TYPES).optional(),
  status: z.enum(C.REQUIREMENT_STATUS).optional(),
  priority: z.enum(C.PRIORITIES).optional(),
});

export const userStoryFilters = z.object({
  requirementId: z.uuid().optional(),
  status: z.enum(C.USER_STORY_STATUS).optional(),
  priority: z.enum(C.PRIORITIES).optional(),
});

export const diagramFilters = z.object({ type: z.enum(C.DIAGRAM_TYPES).optional() });
