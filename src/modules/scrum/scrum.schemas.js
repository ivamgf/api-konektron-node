import { z } from 'zod';
import { longText, optText } from '#shared/schemas.js';

// Scrum (Guia do Scrum 2020): papéis, artefatos com seus compromissos e eventos
export const ROLES = ['product_owner', 'scrum_master', 'developer', 'stakeholder'];
export const ITEM_TYPES = ['story', 'bug', 'technical', 'spike'];
export const ITEM_STATUS = ['new', 'ready', 'in_progress', 'done'];
export const SPRINT_STATUS = ['planned', 'active', 'completed', 'cancelled'];
export const TASK_STATUS = ['todo', 'in_progress', 'done'];
export const EVENT_TYPES = ['planning', 'daily', 'review', 'retrospective', 'refinement'];
export const STORY_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 40, 100];

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9._-]{1,20}$/, { error: 'Use até 20 letras, dígitos, ".", "-" ou "_"' })
  .describe('Único no projeto; convertido para maiúsculas (ex.: "PB-12")');
const title = z.string().trim().min(1).max(200);
const date = z.iso.date().nullable().optional();
const text = (max = 10_000) => longText(max);

// Dados gerais do projeto e compromissos dos artefatos (Meta do Produto, Definição de Pronto)
export const settingsSchema = z.object({
  vision: text().describe('Visão do produto'),
  productGoal: text().describe('Meta do Produto (compromisso do Product Backlog)'),
  definitionOfReady: text().describe('Definição de Preparado (DoR)'),
  definitionOfDone: text().describe('Definição de Pronto (compromisso do Incremento)'),
  sprintLengthDays: z.number().int().min(1).max(31).nullable().optional(),
  startDate: date,
  workingAgreements: text().describe('Acordos de trabalho do time'),
  notes: text(),
});

export const memberSchema = z.object({
  name: title,
  role: z.enum(ROLES),
  email: z.email().max(254).nullable().optional(),
  responsibilities: text(5000),
  capacityHours: z.number().int().min(0).max(1000).nullable().optional().describe('Horas disponíveis por sprint'),
  active: z.boolean().optional(),
});

export const sprintSchema = z.object({
  number: z.number().int().min(1).max(10_000),
  name: optText(200),
  goal: text(5000).describe('Meta da Sprint (compromisso do Sprint Backlog)'),
  startDate: date,
  endDate: date,
  status: z.enum(SPRINT_STATUS).optional(),
  increment: text().describe('Incremento entregue'),
  incrementVersion: optText(50),
  incrementUrl: z.url().max(1000).nullable().optional(),
  notes: text(),
});

export const itemSchema = z.object({
  code,
  title,
  type: z.enum(ITEM_TYPES),
  description: text(),
  acceptanceCriteria: text(),
  storyPoints: z.literal(STORY_POINTS, { error: `Use um destes valores: ${STORY_POINTS.join(', ')}` }).nullable().optional(),
  businessValue: z.number().int().min(0).max(100).nullable().optional(),
  status: z.enum(ITEM_STATUS).optional(),
  sprintId: z.uuid().nullable().optional().describe('Sprint em que o item está (Sprint Backlog); vazio = Product Backlog'),
});

export const taskSchema = z.object({
  sprintId: z.uuid(),
  itemId: z.uuid().nullable().optional(),
  title,
  description: text(5000),
  assigneeId: z.uuid().nullable().optional(),
  status: z.enum(TASK_STATUS).optional(),
  estimateHours: z.number().min(0).max(1000).nullable().optional(),
  remainingHours: z.number().min(0).max(1000).nullable().optional(),
});

const dailyUpdate = z.object({
  memberId: z.uuid(),
  yesterday: z.string().trim().max(2000).optional(),
  today: z.string().trim().max(2000).optional(),
  impediments: z.string().trim().max(2000).optional(),
});

export const eventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  sprintId: z.uuid().nullable().optional(),
  date: z.iso.date(),
  durationMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
  facilitatorId: z.uuid().nullable().optional(),
  participantIds: z.array(z.uuid()).max(100).optional(),
  notes: text(),
  decisions: text(),
  // Daily
  updates: z.array(dailyUpdate).max(100).optional(),
  impediments: text(),
  // Retrospectiva
  wentWell: text(),
  toImprove: text(),
  actionItems: text(),
  // Review
  feedback: text(),
});

export const moveSchema = z.object({ position: z.number().int().min(0) });

// Nomes das colunas criadas num quadro vazio (no idioma de quem publica)
const columnName = z.string().trim().min(1).max(60).optional();
export const publishKanbanSchema = z.object({
  columnNames: z
    .object({ todo: columnName, in_progress: columnName, done: columnName })
    .optional()
    .describe('Só usados se o Kanban ainda não tiver colunas; padrão: A fazer, Fazendo, Feito'),
});

export const itemFilters = z.object({
  status: z.enum(ITEM_STATUS).optional(),
  type: z.enum(ITEM_TYPES).optional(),
  sprintId: z.uuid().optional(),
});
export const taskFilters = z.object({
  sprintId: z.uuid().optional(),
  status: z.enum(TASK_STATUS).optional(),
  assigneeId: z.uuid().optional(),
});
export const eventFilters = z.object({
  type: z.enum(EVENT_TYPES).optional(),
  sprintId: z.uuid().optional(),
});
