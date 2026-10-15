import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import { uniqueIds } from '#shared/projectRefs.js';
import { idParams } from '#shared/schemas.js';
import * as s from './scrum.schemas.js';
import { rollupItem, scrumKanban } from './scrum.kanban.js';
import { scrumService as svc, stampDone } from './scrum.service.js';

// Montado em /projects/:projectId/scrum (authenticate já aplicado pelo módulo projects).
// Qualquer tipo de projeto; planos Standard e Master.
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.SCRUM), loadProject());

const byProject = (req) => ({ projectId: req.project.id });

// ---------- Visão geral e dados gerais ----------
router.get('/', async (req, res) => res.json(await svc.overview(req.project.id)));
router.get('/settings', async (req, res) => res.json(await svc.getSettings(req.project.id)));
router.patch('/settings', validate({ body: s.settingsSchema }), async (req, res) =>
  res.json(await svc.updateSettings(req.project.id, req.validated.body)),
);

// ---------- Papéis (Product Owner, Scrum Master, Developers) ----------
router.use(
  '/members',
  crudRouter({
    table: 'scrum_members',
    label: 'Membro',
    scope: byProject,
    createSchema: s.memberSchema,
    orderBy: [{ column: 'role' }, { column: 'name' }],
    afterDelete: (trx, req, id) => svc.removeMemberFromEvents(trx, req.project.id, id),
  }),
);

// ---------- Product Backlog / Sprint Backlog ----------
router.post('/items/:id/move', validate({ params: idParams, body: s.moveSchema }), async (req, res) =>
  res.json(await svc.moveItem(req.project.id, req.validated.params.id, req.validated.body.position)),
);
router.use(
  '/items',
  crudRouter({
    table: 'scrum_items',
    label: 'Item do backlog',
    scope: byProject,
    createSchema: s.itemSchema,
    filters: s.itemFilters,
    orderBy: [{ column: 'position' }, { column: 'createdAt' }],
    beforeWrite: async (trx, req, data, id) => {
      await svc.assertItemRefs(trx, req.project.id, data);
      stampDone(data, id);
      if (!id) data.position = await svc.nextItemPosition(trx, req.project.id);
    },
  }),
);

// ---------- Sprints e tasks ----------
router.get('/sprints/:id/detail', validate({ params: idParams }), async (req, res) =>
  res.json(await svc.sprintDetail(req.project.id, req.validated.params.id)),
);
// Publica no Kanban as tasks da sprint que ainda não estão no quadro
router.post('/sprints/:id/publish-kanban', validate({ params: idParams, body: s.publishKanbanSchema }), async (req, res) => {
  const result = await scrumKanban.publishSprint(req.project.id, req.validated.params.id, req.validated.body);
  res.json({ ...result, sprint: await svc.sprintDetail(req.project.id, req.validated.params.id) });
});
router.use(
  '/sprints',
  crudRouter({
    table: 'scrum_sprints',
    label: 'Sprint',
    scope: byProject,
    createSchema: s.sprintSchema,
    orderBy: [{ column: 'number', order: 'desc' }],
    beforeWrite: (trx, req, data, id) => svc.assertSprintDates(trx, data, id),
  }),
);
router.use(
  '/tasks',
  crudRouter({
    table: 'scrum_tasks',
    label: 'Task',
    scope: byProject,
    createSchema: s.taskSchema,
    filters: s.taskFilters,
    orderBy: [{ column: 'position' }, { column: 'createdAt' }],
    beforeWrite: async (trx, req, data, id) => {
      await svc.assertTaskRefs(trx, req.project.id, data);
      // task publicada no Kanban: o cartão acompanha (título, responsável, coluna da situação)
      if (id) await scrumKanban.syncTaskToCard(trx, req.project.id, id, data);
      stampDone(data, id);
      if (data.status === 'done') data.remainingHours = 0;
      // item ligado muda de item: o item antigo também é recalculado
      if (id && data.itemId !== undefined) req.previousItemId = (await trx('scrum_tasks').where({ id }).first('itemId'))?.itemId;
    },
    // o item do backlog acompanha as suas tasks (todas concluídas → item concluído)
    afterWrite: async (trx, req, task) => {
      await rollupItem(trx, task.itemId);
      if (req.previousItemId && req.previousItemId !== task.itemId) await rollupItem(trx, req.previousItemId);
    },
  }),
);

// ---------- Eventos ----------
router.use(
  '/events',
  crudRouter({
    table: 'scrum_events',
    label: 'Evento',
    scope: byProject,
    createSchema: s.eventSchema,
    filters: s.eventFilters,
    orderBy: [{ column: 'date', order: 'desc' }, { column: 'createdAt', order: 'desc' }],
    serialize: (data) => jsonbFields('participantIds', 'updates')(uniqueIds(data, 'participantIds')),
    beforeWrite: (trx, req, data) => svc.assertEventRefs(trx, req.project.id, data),
  }),
);

export default router;
