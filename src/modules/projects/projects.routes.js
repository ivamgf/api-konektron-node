import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import crispdmRoutes from '#modules/crisp-dm/crispdm.routes.js';
import systemAnalysisRoutes from '#modules/system-analysis/systemAnalysis.routes.js';
import kanbanRoutes from '#modules/kanban/kanban.routes.js';
import ontologiesRoutes from '#modules/ontologies/ontologies.routes.js';
import bpmRoutes from '#modules/bpm/bpm.routes.js';
import commonkadsRoutes from '#modules/commonkads/commonkads.routes.js';
import { createProjectSchema, listQuery, updateProjectSchema } from './projects.schemas.js';
import { projectsService as s } from './projects.service.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: listQuery }), async (req, res) =>
  res.json(await s.list(req.user, req.validated.query)),
);

router.post('/', validate({ body: createProjectSchema }), async (req, res) => {
  const project = await s.create(req.user, req.validated.body);
  await audit({ userId: req.user.id, action: 'project.create', description: project.id, req });
  res.status(201).json(project);
});

router.get('/:projectId', loadProject(), (req, res) => res.json(req.project));

router.patch('/:projectId', loadProject(), validate({ body: updateProjectSchema }), async (req, res) =>
  res.json(await s.update(req.project, req.validated.body)),
);

router.delete('/:projectId', loadProject(), async (req, res) => {
  await s.remove(req.project);
  await audit({ userId: req.user.id, action: 'project.delete', description: req.project.id, req });
  res.status(204).end();
});

// Módulos por tipo de projeto
router.use('/:projectId/system-analysis', systemAnalysisRoutes);
router.use('/:projectId/crisp-dm', crispdmRoutes);
// Módulos para qualquer tipo de projeto
router.use('/:projectId/ontologies', ontologiesRoutes);
router.use('/:projectId/bpm', bpmRoutes);
router.use('/:projectId/commonkads', commonkadsRoutes);
router.use('/:projectId/kanban', kanbanRoutes);

export default router;
