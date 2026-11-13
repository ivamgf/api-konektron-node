import { Router } from 'express';
import { SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { crudRouter } from '#shared/crudRouter.js';
import * as s from './systemAnalysis.schemas.js';
import { systemAnalysisService as svc } from './systemAnalysis.service.js';

// Montado em /projects/:projectId/system-analysis (authenticate já aplicado pelo módulo projects)
const router = Router({ mergeParams: true });
router.use(
  requireSection(SECTIONS.SYSTEM_ANALYSIS),
  loadProject({ type: SECTION_PROJECT_TYPE[SECTIONS.SYSTEM_ANALYSIS] }),
);

const byProject = (req) => ({ projectId: req.project.id });

// ---------- Visão geral, análise e relatório ----------
router.get('/', async (req, res) => res.json(await svc.overview(req.project)));
router.get('/report', async (req, res) => res.json(await svc.report(req.project)));

router.get('/analysis', async (req, res) => res.json(await svc.getAnalysis(req.project.id)));
router.patch('/analysis', validate({ body: s.analysisUpdateSchema }), async (req, res) =>
  res.json(await svc.updateAnalysis(req.project.id, req.validated.body)),
);

// ---------- Modelos de projeto (ex.: ERS de cadastro, autenticação e perfil) ----------
router.get('/templates', (_req, res) => res.json(svc.listTemplates()));
router.post('/templates/:templateKey/apply', validate({ params: s.templateParams }), async (req, res) => {
  const result = await svc.applyTemplate(req.project, req.validated.params.templateKey);
  await audit({
    userId: req.user.id,
    action: 'project.template',
    description: `${req.project.id} · ${req.validated.params.templateKey}`,
    req,
  });
  res.json(result);
});

// ---------- Artefatos ----------
router.use(
  '/requirements',
  crudRouter({
    table: 'requirements',
    label: 'Requisito',
    scope: byProject,
    createSchema: s.requirementSchema,
    filters: s.requirementFilters,
    orderBy: [{ column: 'type' }, { column: 'code' }],
  }),
);

router.use(
  '/user-stories',
  crudRouter({
    table: 'user_stories',
    label: 'História de usuário',
    scope: byProject,
    createSchema: s.userStorySchema,
    filters: s.userStoryFilters,
    orderBy: [{ column: 'code' }],
    beforeWrite: (trx, req, data) =>
      svc.assertRequirementInProject(trx, req.project.id, data.requirementId),
  }),
);

router.use(
  '/diagrams',
  crudRouter({
    table: 'diagrams',
    label: 'Diagrama',
    scope: byProject,
    createSchema: s.diagramSchema,
    filters: s.diagramFilters,
    orderBy: [{ column: 'type' }, { column: 'title' }],
  }),
);

export default router;
