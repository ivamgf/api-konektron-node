import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { crudRouter } from '#shared/crudRouter.js';
import { fileRoutes } from '#shared/files.js';
import { assertInProject, assertParent } from '#shared/projectRefs.js';
import { FILE_EXTENSIONS } from './bpm.constants.js';
import * as s from './bpm.schemas.js';
import { bpmService as svc } from './bpm.service.js';

// Montado em /projects/:projectId/bpm (authenticate já aplicado pelo módulo projects).
// Qualquer tipo de projeto; planos Standard e Master.
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.BPM), loadProject());

const byProject = (req) => ({ projectId: req.project.id });

router.get('/', async (req, res) => res.json(await svc.overview(req.project.id)));

// ---------- Arquitetura de processos (com SIPOC e diagnóstico) ----------
router.use(
  '/processes',
  crudRouter({
    table: 'bpm_processes',
    label: 'Processo',
    scope: byProject,
    createSchema: s.processSchema,
    filters: s.processFilters,
    orderBy: [{ column: 'code' }],
    beforeWrite: (trx, req, data, id) =>
      assertParent(trx, 'bpm_processes', 'parentId', req.project.id, data.parentId, id),
  }),
);

// ---------- Diagramas BPMN (arquivo .bpmn/.xml, imagem ou PDF) ----------
router.use(
  '/diagrams',
  fileRoutes({
    table: 'bpm_diagrams',
    blobTable: 'bpm_diagram_files',
    foreignKey: 'diagramId',
    label: 'Diagrama',
    scope: byProject,
    extensions: FILE_EXTENSIONS,
    onUpload: svc.onUpload,
    onRemove: { metrics: null },
  }),
);
router.use(
  '/diagrams',
  crudRouter({
    table: 'bpm_diagrams',
    label: 'Diagrama',
    scope: byProject,
    createSchema: s.diagramSchema,
    filters: s.diagramFilters,
    orderBy: [{ column: 'title' }],
    beforeWrite: (trx, req, data) => assertInProject(trx, 'bpm_processes', req.project.id, data.processId, 'processId'),
  }),
);

export default router;
