import { Router } from 'express';
import { z } from 'zod';
import { db } from '#database/connection.js';
import { SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { crudRouter } from '#shared/crudRouter.js';
import { idParams } from '#shared/schemas.js';
import { AppError } from '#utils/AppError.js';
import * as s from './fp.schemas.js';
import { fpService as svc } from './fp.service.js';

// Montado em /projects/:projectId/function-points (authenticate já aplicado pelo módulo projects).
// Projetos `software`, plano Master.
const router = Router({ mergeParams: true });
router.use(
  requireSection(SECTIONS.FUNCTION_POINT),
  loadProject({ type: SECTION_PROJECT_TYPE[SECTIONS.FUNCTION_POINT] }),
);

const byProject = (req) => ({ projectId: req.project.id });

// Contagens com o total de PF
router.get('/', async (req, res) => res.json(await svc.overview(req.project.id)));

router.get('/counts/:id/summary', validate({ params: idParams }), async (req, res) =>
  res.json(await svc.summary(req.project.id, req.validated.params.id)),
);

// Funções da contagem: /counts/:countId/functions (complexidade e PF calculados na gravação)
const ensureCount = async (req, _res, next) => {
  const { countId } = req.params;
  const ok = z.uuid().safeParse(countId).success
    && (await db('fp_counts').where({ id: countId, projectId: req.project.id }).first('id'));
  if (!ok) throw AppError.notFound('Contagem');
  next();
};
router.use(
  '/counts/:countId/functions',
  ensureCount,
  crudRouter({
    table: 'fp_functions',
    label: 'Função',
    scope: (req) => ({ countId: req.params.countId }),
    createSchema: s.functionSchema,
    filters: s.functionFilters,
    orderBy: [{ column: 'type' }, { column: 'name' }],
    beforeWrite: (trx, req, data, id) => svc.evaluateWrite(trx, req.params.countId, data, id),
  }),
);

router.use(
  '/counts',
  crudRouter({
    table: 'fp_counts',
    label: 'Contagem',
    scope: byProject,
    createSchema: s.countSchema,
    orderBy: [{ column: 'createdAt', order: 'desc' }],
  }),
);

export default router;
