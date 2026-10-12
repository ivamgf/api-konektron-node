import { z } from 'zod';
import { pagination } from '#shared/schemas.js';

// `meta` só descreve o tipo para a documentação (Date não tem representação em JSON Schema)
const dateTime = z.coerce.date().meta({ type: 'string', format: 'date-time' });

export const listQuery = z.object({
  ...pagination,
  userId: z.uuid().optional(),
  action: z.string().max(100).optional().describe('Ex.: auth.login, project.create'),
  from: dateTime.optional(),
  to: dateTime.optional(),
});
