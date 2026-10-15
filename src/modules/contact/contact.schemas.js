import { z } from 'zod';
import { pagination } from '#shared/schemas.js';

export const CONTACT_STATUS = ['new', 'read', 'answered', 'archived'];

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  // apara antes de validar (no Zod 4 o formato é conferido antes do trim encadeado)
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  // armadilha para robôs: campo escondido no formulário, pessoas não preenchem
  website: z.string().max(200).optional().describe('Deixe vazio (anti-spam)'),
});

export const contactListQuery = z.object({
  ...pagination,
  status: z.enum(CONTACT_STATUS).optional(),
});

export const contactUpdateSchema = z.object({ status: z.enum(CONTACT_STATUS) });
