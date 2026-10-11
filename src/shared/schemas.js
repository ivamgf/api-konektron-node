import { z } from 'zod';

export const idParams = z.object({ id: z.uuid() });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

// Texto opcional e anulável (útil em PATCH)
export const optText = (max = 255) => z.string().trim().max(max).nullable().optional();
export const longText = (max = 50_000) => z.string().max(max).nullable().optional();

// Obs. Zod 4: evitamos .default() em schemas de corpo, pois .partial() (PATCH)
// continuaria aplicando os defaults. Os valores padrão ficam no banco.
