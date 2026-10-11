import { Router } from 'express';
import { z } from 'zod';
import { db } from '#database/connection.js';
import { SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { AppError } from '#utils/AppError.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import * as s from './crispdm.schemas.js';
import { crispdmService as svc } from './crispdm.service.js';

// Montado em /projects/:projectId/crisp-dm (authenticate já aplicado pelo módulo projects)
const router = Router({ mergeParams: true });
router.use(
  requireSection(SECTIONS.CRISP_DM),
  loadProject({ type: SECTION_PROJECT_TYPE[SECTIONS.CRISP_DM] }),
);

const byProject = (req) => ({ projectId: req.project.id });

// Garante que :datasetId / :modelId pertencem ao projeto antes de acessar os filhos
const ensureChild = (table, param, label) => async (req, _res, next) => {
  const id = req.params[param];
  const ok = z.uuid().safeParse(id).success
    && (await db(table).where({ id, projectId: req.project.id }).first('id'));
  if (!ok) throw AppError.notFound(label);
  next();
};

// ---------- Visão geral e relatório ----------
router.get('/', async (req, res) => res.json(await svc.overview(req.project)));
router.get('/report', async (req, res) => res.json(await svc.report(req.project)));

// ---------- Fases ----------
router.get('/phases', async (req, res) => res.json(await svc.listPhases(req.project.id)));

router.get('/phases/:phase', validate({ params: s.phaseParams }), async (req, res) =>
  res.json(await svc.getPhase(req.project.id, req.validated.params.phase)),
);

router.patch(
  '/phases/:phase',
  validate({ params: s.phaseParams, body: s.phaseUpdateSchema }),
  async (req, res) => {
    const { phase } = req.validated.params;
    const row = await svc.updatePhase(req.project.id, phase, req.validated.body);
    if (req.validated.body.status) {
      await audit({
        userId: req.user.id,
        action: 'crispdm.phase_status',
        description: `${req.project.id}:${phase}:${row.status}`,
        req,
      });
    }
    res.json(row);
  },
);

// ---------- Business Understanding ----------
router.use(
  '/objectives',
  crudRouter({
    table: 'crispdm_objectives',
    label: 'Objetivo',
    scope: byProject,
    createSchema: s.objectiveSchema,
    orderBy: [{ column: 'type' }, { column: 'priority' }, { column: 'createdAt' }],
  }),
);

// ---------- Data Understanding ----------
// (rota dos filhos antes do CRUD de datasets)
router.use(
  '/datasets/:datasetId/fields',
  ensureChild('crispdm_datasets', 'datasetId', 'Dataset'),
  crudRouter({
    table: 'crispdm_dataset_fields',
    label: 'Campo',
    scope: (req) => ({ datasetId: req.params.datasetId }),
    createSchema: s.datasetFieldSchema,
    orderBy: [{ column: 'name' }],
    serialize: jsonbFields('stats'),
  }),
);

router.use(
  '/datasets',
  crudRouter({
    table: 'crispdm_datasets',
    label: 'Dataset',
    scope: byProject,
    createSchema: s.datasetSchema,
    orderBy: [{ column: 'name' }],
  }),
);

// ---------- Data Preparation ----------
router.use(
  '/preparation-steps',
  crudRouter({
    table: 'crispdm_preparation_steps',
    label: 'Passo de preparação',
    scope: byProject,
    createSchema: s.preparationStepSchema,
    orderBy: [{ column: 'stepOrder' }, { column: 'createdAt' }],
    beforeWrite: (trx, req, data) => svc.assertDatasetInProject(trx, req.project.id, data.datasetId),
  }),
);

// ---------- Modeling / Evaluation ----------
router.use(
  '/models/:modelId/metrics',
  ensureChild('crispdm_models', 'modelId', 'Modelo'),
  crudRouter({
    table: 'crispdm_model_metrics',
    label: 'Métrica',
    scope: (req) => ({ modelId: req.params.modelId }),
    createSchema: s.modelMetricSchema,
    orderBy: [{ column: 'split' }, { column: 'metric' }],
  }),
);

router.use(
  '/models',
  crudRouter({
    table: 'crispdm_models',
    label: 'Modelo',
    scope: byProject,
    createSchema: s.modelSchema,
    serialize: jsonbFields('hyperparameters'),
    beforeWrite: (trx, req, data) =>
      svc.assertDatasetInProject(trx, req.project.id, data.trainingDatasetId),
  }),
);

export default router;
