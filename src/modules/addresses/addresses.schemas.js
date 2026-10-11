import { z } from 'zod';
import { optText } from '#shared/schemas.js';

export const addressSchema = z.object({
  street: z.string().trim().min(1).max(200),
  number: optText(20),
  complement: optText(200),
  district: optText(200),
  city: z.string().trim().min(1).max(200),
  state: z.string().trim().min(2).max(50),
  postalCode: optText(20),
  country: z.string().length(2).toUpperCase().optional().describe('ISO 3166-1 alfa-2 (padrão: BR)'),
  isPrimary: z.boolean().optional().describe('Marcar um endereço como principal desmarca os demais'),
});
