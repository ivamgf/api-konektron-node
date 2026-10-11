import { Router } from 'express';
import { z } from 'zod';
import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { validate } from '#middlewares/validate.js';
import { idParams } from '#shared/schemas.js';

/**
 * Gera rotas CRUD (GET /, POST /, GET /:id, PATCH /:id, DELETE /:id) para um recurso
 * sempre filtrado por um escopo (ex.: { projectId } ou { userId }).
 *
 * @param {object}   o
 * @param {string}   o.table          tabela (snake_case)
 * @param {Function} o.scope          (req) => objeto where aplicado em todas as operações
 * @param {object}   o.createSchema   schema zod do POST
 * @param {object}  [o.updateSchema]  schema zod do PATCH (padrão: createSchema.partial())
 * @param {Array}   [o.orderBy]       ordenação da listagem
 * @param {object}  [o.filters]       schema zod da query do GET / (igualdade por coluna)
 * @param {Function}[o.serialize]     transforma o corpo antes de gravar (ex.: jsonb)
 * @param {Function}[o.beforeWrite]   async (trx, req, data) => void — validações/efeitos extras
 * @param {string}  [o.label]         nome para mensagens de erro
 */
export function crudRouter({
  table,
  scope,
  createSchema,
  updateSchema = createSchema.partial(),
  orderBy = [{ column: 'createdAt', order: 'asc' }],
  filters = z.object({}),
  serialize = (d) => d,
  beforeWrite,
  label = 'Registro',
}) {
  const router = Router({ mergeParams: true });
  const scoped = (q, req) => q.where(scope(req));

  router.get('/', validate({ query: filters }), async (req, res) => {
    // o escopo é aplicado por último para nunca ser sobrescrito por um filtro
    res.json(await db(table).where(req.validated.query).where(scope(req)).orderBy(orderBy));
  });

  router.post('/', validate({ body: createSchema }), async (req, res) => {
    const row = await db.transaction(async (trx) => {
      const data = serialize(req.validated.body);
      await beforeWrite?.(trx, req, data);
      const [created] = await trx(table).insert({ ...data, ...scope(req) }).returning('*');
      return created;
    });
    res.status(201).json(row);
  });

  router.get('/:id', validate({ params: idParams }), async (req, res) => {
    const row = await scoped(db(table), req).where({ id: req.validated.params.id }).first();
    if (!row) throw AppError.notFound(label);
    res.json(row);
  });

  router.patch('/:id', validate({ params: idParams, body: updateSchema }), async (req, res) => {
    const data = serialize(req.validated.body);
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    const row = await db.transaction(async (trx) => {
      await beforeWrite?.(trx, req, data, req.validated.params.id);
      const [updated] = await scoped(trx(table), req)
        .where({ id: req.validated.params.id })
        .update(data)
        .returning('*');
      return updated;
    });
    if (!row) throw AppError.notFound(label);
    res.json(row);
  });

  router.delete('/:id', validate({ params: idParams }), async (req, res) => {
    const n = await scoped(db(table), req).where({ id: req.validated.params.id }).del();
    if (!n) throw AppError.notFound(label);
    res.status(204).end();
  });

  return router;
}

// Converte campos para JSON antes de gravar em colunas jsonb
// (o driver pg converteria arrays JS em arrays Postgres, não em JSON)
export const jsonbFields =
  (...fields) =>
  (data) => {
    const out = { ...data };
    for (const f of fields) if (out[f] !== undefined && out[f] !== null) out[f] = JSON.stringify(out[f]);
    return out;
  };
