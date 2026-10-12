import { Router } from 'express';
import { z } from 'zod';
import { db } from '#database/connection.js';
import { SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import { idParams } from '#shared/schemas.js';
import { AppError } from '#utils/AppError.js';
import * as s from './systemView.schemas.js';
import { systemViewService as svc } from './systemView.service.js';

// Montado em /projects/:projectId/system-view (authenticate já aplicado pelo módulo projects).
// Extensão da Análise de Sistemas: projetos `software`, planos Standard e Master.
const router = Router({ mergeParams: true });
router.use(
  requireSection(SECTIONS.SYSTEM_VIEW),
  loadProject({ type: SECTION_PROJECT_TYPE[SECTIONS.SYSTEM_VIEW] }),
);

const byProject = (req) => ({ projectId: req.project.id });

// ---------- Visão geral, documento e BDD ----------
router.get('/', async (req, res) => res.json(await svc.overview(req.project)));
router.get('/report', async (req, res) => res.json(await svc.report(req.project)));
router.get('/features', validate({ query: s.langQuery }), async (req, res) =>
  res.json(await svc.features(req.project.id, req.validated.query.lang)),
);

router.get('/spec', async (req, res) => res.json(await svc.getSpec(req.project.id)));
router.patch('/spec', validate({ body: s.specUpdateSchema }), async (req, res) =>
  res.json(await svc.updateSpec(req.project.id, req.validated.body)),
);

// ---------- Stakeholders e glossário ----------
router.use('/stakeholders', crudRouter({
  table: 'stakeholders', label: 'Stakeholder', scope: byProject, createSchema: s.stakeholderSchema, orderBy: [{ column: 'code' }],
}));
router.use('/glossary', crudRouter({
  table: 'glossary_terms', label: 'Termo', scope: byProject, createSchema: s.glossarySchema, orderBy: [{ column: 'term' }],
}));

// ---------- Casos de uso ----------
router.get('/use-cases/:id', validate({ params: idParams }), async (req, res) =>
  res.json(await svc.useCaseDetail(req.project.id, req.validated.params.id)),
);
router.post(
  '/use-cases/:id/scenarios',
  validate({ params: idParams, query: s.langQuery, body: z.object({ userStoryId: z.uuid().nullable().optional() }) }),
  async (req, res) =>
    res.status(201).json(await svc.generateScenarios(req.project.id, req.validated.params.id, {
      lang: req.validated.query.lang, userStoryId: req.validated.body.userStoryId,
    })),
);
router.use('/use-cases', crudRouter({
  table: 'use_cases',
  label: 'Caso de uso',
  scope: byProject,
  createSchema: s.useCaseSchema,
  orderBy: [{ column: 'code' }],
  serialize: jsonbFields('requirementIds'),
  beforeWrite: async (trx, req, data, id) => {
    if (data.requirementIds) await svc.assertRequirements(trx, req.project.id, JSON.parse(data.requirementIds));
    if (data.generalUseCaseId !== undefined) await svc.assertGeneral(trx, req.project.id, data.generalUseCaseId, id);
  },
}));

// Cenários (fluxos) de um caso de uso: /use-cases/:useCaseId/flows
const ensureUseCase = async (req, _res, next) => {
  const { useCaseId } = req.params;
  const ok = z.uuid().safeParse(useCaseId).success
    && (await db('use_cases').where({ id: useCaseId, projectId: req.project.id }).first('id'));
  if (!ok) throw AppError.notFound('Caso de uso');
  next();
};
router.use('/use-cases/:useCaseId/flows', ensureUseCase, crudRouter({
  table: 'use_case_flows',
  label: 'Cenário do caso de uso',
  scope: (req) => ({ useCaseId: req.params.useCaseId }),
  createSchema: s.flowSchema,
  orderBy: [{ column: 'position' }, { column: 'createdAt' }],
  serialize: jsonbFields('steps'),
  beforeWrite: async (trx, req, data, id) => {
    if (data.kind) await svc.assertSingleMain(trx, req.params.useCaseId, data, id);
    if (!id && data.position === undefined) {
      const row = await trx('use_case_flows').where({ useCaseId: req.params.useCaseId }).max({ max: 'position' }).first();
      data.position = row?.max == null ? 0 : row.max + 1;
    }
  },
}));

// ---------- Relações <<include>> / <<extend>> ----------
router.use('/relations', crudRouter({
  table: 'use_case_relations',
  label: 'Relação',
  scope: byProject,
  createSchema: s.relationSchema,
  beforeWrite: async (trx, req, data) => {
    if (data.fromUseCaseId && data.fromUseCaseId === data.toUseCaseId) {
      throw new AppError('Dados inválidos', 422, { toUseCaseId: ['Escolha outro caso de uso'] });
    }
    await svc.assertInProject(trx, 'use_cases', req.project.id, data.fromUseCaseId, 'fromUseCaseId');
    await svc.assertInProject(trx, 'use_cases', req.project.id, data.toUseCaseId, 'toUseCaseId');
  },
}));

// ---------- Cenários BDD ----------
router.use('/scenarios', crudRouter({
  table: 'bdd_scenarios',
  label: 'Cenário',
  scope: byProject,
  createSchema: s.scenarioSchema,
  filters: s.scenarioFilters,
  orderBy: [{ column: 'position' }, { column: 'createdAt' }],
  beforeWrite: async (trx, req, data, id) => {
    await svc.assertInProject(trx, 'user_stories', req.project.id, data.userStoryId, 'userStoryId');
    await svc.assertInProject(trx, 'use_cases', req.project.id, data.useCaseId, 'useCaseId');
    // novo cenário entra no fim
    if (!id && data.position === undefined) {
      const row = await trx('bdd_scenarios').where({ projectId: req.project.id }).max({ max: 'position' }).first();
      data.position = row?.max == null ? 0 : row.max + 1;
    }
  },
}));

export default router;
