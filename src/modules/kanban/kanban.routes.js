import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { crudRouter } from '#shared/crudRouter.js';
import { idParams } from '#shared/schemas.js';
import * as s from './kanban.schemas.js';
import { kanbanService as svc } from './kanban.service.js';

// Montado em /projects/:projectId/kanban (authenticate já aplicado pelo módulo projects).
// Vale para qualquer tipo de projeto e todos os planos.
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.KANBAN), loadProject());

const byProject = (req) => ({ projectId: req.project.id });

// ---------- Quadro ----------
router.get('/', async (req, res) => res.json(await svc.board(req.project.id)));

// ---------- Colunas ----------
router.post('/columns/:id/move', validate({ params: idParams, body: s.moveColumnSchema }), async (req, res) =>
  res.json(await svc.moveColumn(req.project.id, req.validated.params.id, req.validated.body.position)),
);

router.use(
  '/columns',
  crudRouter({
    table: 'kanban_columns',
    label: 'Coluna',
    scope: byProject,
    createSchema: s.columnSchema,
    orderBy: [{ column: 'position' }, { column: 'createdAt' }],
    // nova coluna entra à direita
    beforeWrite: async (trx, req, data, id) => {
      if (!id) data.position = await svc.nextPosition(trx, 'kanban_columns', { projectId: req.project.id });
    },
  }),
);

// ---------- Cartões ----------
router.post('/cards/:id/move', validate({ params: idParams, body: s.moveCardSchema }), async (req, res) =>
  res.json(await svc.moveCard(req.project.id, req.validated.params.id, req.validated.body)),
);

router.use(
  '/cards',
  crudRouter({
    table: 'kanban_cards',
    label: 'Cartão',
    scope: byProject,
    createSchema: s.cardSchema,
    updateSchema: s.cardUpdateSchema,
    filters: s.cardFilters,
    orderBy: [{ column: 'position' }, { column: 'createdAt' }],
    // novo cartão entra no fim da coluna escolhida
    beforeWrite: async (trx, req, data, id) => {
      if (id) return;
      await svc.assertColumnInProject(trx, req.project.id, data.columnId);
      data.position = await svc.nextPosition(trx, 'kanban_cards', { columnId: data.columnId });
    },
  }),
);

export default router;
