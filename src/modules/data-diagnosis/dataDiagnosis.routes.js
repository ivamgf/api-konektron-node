import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { db } from '#database/connection.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import * as s from './dataDiagnosis.schemas.js';

// Montado em /projects/:projectId/data-diagnosis (authenticate já aplicado pelo módulo projects).
// Qualquer tipo de projeto. Cada documento guarda as seções do modelo em `content` (jsonb).
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.DATA_DIAGNOSIS), loadProject());

const byProject = (req) => ({ projectId: req.project.id });
export const DOCUMENTS = [
  { path: 'inventories', table: 'dd_inventories', label: 'Inventário', schema: s.inventorySchema },
  { path: 'reports', table: 'dd_reports', label: 'Relatório de diagnóstico', schema: s.reportSchema },
  { path: 'plans', table: 'dd_plans', label: 'Plano de implantação', schema: s.planSchema },
];

// Visão geral: os documentos de cada tipo, sem o conteúdo
router.get('/', async (req, res) => {
  const entries = await Promise.all(
    DOCUMENTS.map(async ({ path, table }) => [
      path,
      await db(table)
        .where(byProject(req))
        .orderBy('updatedAt', 'desc')
        .select('id', 'title', 'version', 'createdAt', 'updatedAt'),
    ]),
  );
  res.json(Object.fromEntries(entries));
});

for (const { path, table, label, schema } of DOCUMENTS) {
  router.use(
    `/${path}`,
    crudRouter({
      table,
      label,
      scope: byProject,
      createSchema: schema,
      orderBy: [{ column: 'updatedAt', order: 'desc' }],
      serialize: jsonbFields('content'),
    }),
  );
}

export default router;
