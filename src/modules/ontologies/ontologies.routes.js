import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import { fileRoutes } from '#shared/files.js';
import { uniqueIds } from '#shared/projectRefs.js';
import { FILE_EXTENSIONS } from './ontologies.constants.js';
import * as s from './ontologies.schemas.js';
import { ontologiesService as svc } from './ontologies.service.js';

// Montado em /projects/:projectId/ontologies (authenticate já aplicado pelo módulo projects).
// Qualquer tipo de projeto; plano Master. A raiz é a própria coleção de ontologias.
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.ONTOLOGIES), loadProject());

const byProject = (req) => ({ projectId: req.project.id });

// (antes do CRUD: "summary" não é um :id)
router.get('/summary', async (req, res) => res.json(await svc.summary(req.project.id)));

router.use(
  '/',
  fileRoutes({
    table: 'ontologies',
    blobTable: 'ontology_files',
    foreignKey: 'ontologyId',
    label: 'Ontologia',
    scope: byProject,
    extensions: FILE_EXTENSIONS,
    onUpload: svc.onUpload,
    onRemove: { analysis: null },
  }),
);

router.use(
  '/',
  crudRouter({
    table: 'ontologies',
    label: 'Ontologia',
    scope: byProject,
    createSchema: s.ontologySchema,
    filters: s.ontologyFilters,
    orderBy: [{ column: 'title' }],
    serialize: (data) => jsonbFields('vocabularies', 'principles')(uniqueIds(data, 'vocabularies', 'principles')),
  }),
);

export default router;
