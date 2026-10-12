import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';
import * as C from './crispdm.constants.js';

// ---------- Fases ----------
const textTasks = (tasks) => Object.fromEntries(tasks.map((t) => [t, longText()]));

export const PHASE_CONTENT_SCHEMAS = Object.fromEntries(
  C.PHASES.map((p) => {
    const shape = textTasks(p.tasks);
    if (p.key === 'evaluation') shape.decision = z.enum(C.EVALUATION_DECISIONS).nullable().optional();
    return [p.key, z.object(shape)];
  }),
);

export const phaseParams = z.object({ phase: z.enum(C.PHASE_KEYS) });

export const phaseUpdateSchema = z.object({
  status: z.enum(C.PHASE_STATUS).optional(),
  notes: longText(),
  // validado depois, conforme a fase (ver crispdm.service)
  content: z.record(z.string(), z.unknown()).optional(),
});

// ---------- Recursos ----------
export const objectiveSchema = z.object({
  type: z.enum(C.OBJECTIVE_TYPES),
  description: z.string().trim().min(1).max(5000),
  successCriteria: longText(5000),
  priority: z.number().int().min(1).max(5).optional(),
  achieved: z.boolean().nullable().optional(),
});

export const datasetSchema = z.object({
  name: z.string().trim().min(1).max(200),
  source: optText(200),
  format: optText(50),
  location: optText(1000),
  rowCount: z.number().int().nonnegative().nullable().optional(),
  columnCount: z.number().int().nonnegative().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().nullable().optional(),
  collectedAt: z.iso.date().nullable().optional(),
  description: longText(),
  qualityNotes: longText(),
});

export const datasetFieldSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dataType: z.enum(C.FIELD_DATA_TYPES),
  role: z.enum(C.FIELD_ROLES).optional(),
  description: longText(5000),
  missingPct: z.number().min(0).max(100).nullable().optional(),
  uniqueCount: z.number().int().nonnegative().nullable().optional(),
  stats: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const preparationStepSchema = z.object({
  datasetId: z.uuid().nullable().optional(),
  stepOrder: z.number().int().min(1),
  operation: z.enum(C.PREP_OPERATIONS),
  description: z.string().trim().min(1).max(5000),
  rationale: longText(5000),
  codeRef: optText(1000),
});

export const modelSchema = z.object({
  name: z.string().trim().min(1).max(200),
  technique: z.enum(C.MODEL_TECHNIQUES),
  algorithm: optText(200),
  trainingDatasetId: z.uuid().nullable().optional(),
  hyperparameters: z.record(z.string(), z.unknown()).nullable().optional(),
  assumptions: longText(5000),
  status: z.enum(C.MODEL_STATUS).optional(),
  artifactUri: optText(1000),
  notes: longText(),
});

export const modelMetricSchema = z.object({
  metric: z.string().trim().min(1).max(50),
  value: z.number(),
  split: z.enum(C.METRIC_SPLITS).optional(),
  notes: longText(2000),
});
