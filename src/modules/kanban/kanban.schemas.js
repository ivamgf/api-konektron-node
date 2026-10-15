import { z } from 'zod';
import { TASK_STATUS } from '#modules/scrum/scrum.schemas.js';
import { longText, optText } from '#shared/schemas.js';

// Kanban — quadro de tarefas de qualquer projeto
export const CARD_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export const columnSchema = z.object({
  name: z.string().trim().min(1).max(60),
  wipLimit: z.number().int().min(1).max(999).nullable().optional().describe('Limite de cartões (informativo)'),
  taskStatus: z
    .enum(TASK_STATUS)
    .nullable()
    .optional()
    .describe('Situação das tasks do Scrum nesta coluna: o cartão de uma task que entra aqui muda a task para ela'),
});

export const cardSchema = z.object({
  columnId: z.uuid().describe('Coluna do mesmo projeto; o cartão entra no fim dela'),
  title: z.string().trim().min(1).max(200),
  description: longText(10_000),
  priority: z.enum(CARD_PRIORITIES).nullable().optional(),
  dueDate: z.iso.date().nullable().optional(),
  assignee: optText(120),
});

// A coluna e a ordem só mudam por /move, que reordena os vizinhos
export const cardUpdateSchema = cardSchema.omit({ columnId: true }).partial();

export const moveColumnSchema = z.object({
  position: z.number().int().min(0).describe('Nova posição (0 = primeira); acima do fim vai para o fim'),
});

export const moveCardSchema = z.object({
  columnId: z.uuid().describe('Coluna de destino (pode ser a mesma)'),
  position: z.number().int().min(0).describe('Posição na coluna de destino (0 = topo); acima do fim vai para o fim'),
});

export const cardFilters = z.object({
  columnId: z.uuid().optional(),
  priority: z.enum(CARD_PRIORITIES).optional(),
});
