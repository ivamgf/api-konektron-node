import { z } from 'zod';
import { optText } from '#shared/schemas.js';

export const updateProfileSchema = z.object({
  fullName: optText(200),
  nickname: optText(100),
  avatarUrl: z.url().max(500).nullable().optional(),
  phoneMobile: optText(20),
  phoneLandline: optText(20),
  company: optText(200),
  department: optText(200),
  jobTitle: optText(200),
  birthDate: z.iso.date().nullable().optional(),
  locale: z.enum(['en', 'pt-BR']).optional(),
  socialNetworks: z
    .array(z.object({ network: z.string().trim().min(1).max(50), url: z.url().max(500) }))
    .max(20)
    .optional(),
});
