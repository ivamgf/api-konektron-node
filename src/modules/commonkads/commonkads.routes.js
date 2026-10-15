import { Router } from 'express';
import { SECTIONS } from '#config/plans.js';
import { requireSection } from '#middlewares/authorize.js';
import { loadProject } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { crudRouter, jsonbFields } from '#shared/crudRouter.js';
import { uniqueIds } from '#shared/projectRefs.js';
import * as s from './commonkads.schemas.js';
import { commonkadsService as svc } from './commonkads.service.js';

// Montado em /projects/:projectId/commonkads (authenticate já aplicado pelo módulo projects).
// Qualquer tipo de projeto; plano Master.
const router = Router({ mergeParams: true });
router.use(requireSection(SECTIONS.COMMONKADS), loadProject());

const byProject = (req) => ({ projectId: req.project.id });
const lists = (...fields) => (data) => jsonbFields(...fields)(uniqueIds(data, ...fields));

// ---------- Visão geral e documento ----------
router.get('/', async (req, res) => res.json(await svc.overview(req.project.id)));
router.get('/report', async (req, res) => res.json(await svc.report(req.project)));

// ---------- Planilhas (OM-1, OM-2, OM-5, OTA-1, KM-1, DM-1..4 e a situação de todas) ----------
router.get('/worksheets', async (req, res) => res.json(await svc.listWorksheets(req.project.id)));
router.get('/worksheets/:key', validate({ params: s.worksheetParams }), async (req, res) =>
  res.json(await svc.getWorksheet(req.project.id, req.validated.params.key)),
);
router.patch('/worksheets/:key', validate({ params: s.worksheetParams, body: s.worksheetUpdateSchema }), async (req, res) =>
  res.json(await svc.updateWorksheet(req.project.id, req.validated.params.key, req.validated.body)),
);

// ---------- OM-3 / TM-1: tarefas ----------
router.use(
  '/tasks',
  crudRouter({
    table: 'ck_tasks',
    label: 'Tarefa',
    scope: byProject,
    createSchema: s.taskSchema,
    orderBy: [{ column: 'code' }],
    serialize: lists('agentIds', 'knowledgeIds'),
    beforeWrite: (trx, req, data) =>
      svc.assertTaskRefs(trx, req.project.id, {
        agentIds: data.agentIds && JSON.parse(data.agentIds),
        knowledgeIds: data.knowledgeIds && JSON.parse(data.knowledgeIds),
      }),
  }),
);

// ---------- OM-4 / TM-2: conhecimento ----------
router.use(
  '/knowledge',
  crudRouter({
    table: 'ck_knowledge',
    label: 'Item de conhecimento',
    scope: byProject,
    createSchema: s.knowledgeSchema,
    orderBy: [{ column: 'name' }],
    serialize: jsonbFields('characterization'),
    afterDelete: (trx, req, id) => svc.removeIdFromLists(trx, 'ck_knowledge', req.project.id, id),
  }),
);

// ---------- AM-1 / MAS: agentes ----------
router.use(
  '/agents',
  crudRouter({
    table: 'ck_agents',
    label: 'Agente',
    scope: byProject,
    createSchema: s.agentSchema,
    orderBy: [{ column: 'name' }],
    serialize: lists('knowledgeIds', 'communicatesWithIds'),
    beforeWrite: (trx, req, data, id) =>
      svc.assertAgentRefs(
        trx,
        req.project.id,
        {
          knowledgeIds: data.knowledgeIds && JSON.parse(data.knowledgeIds),
          communicatesWithIds: data.communicatesWithIds && JSON.parse(data.communicatesWithIds),
        },
        id,
      ),
    afterDelete: (trx, req, id) => svc.removeIdFromLists(trx, 'ck_agents', req.project.id, id),
  }),
);

// ---------- CM-1 / CM-2: transações ----------
router.use(
  '/transactions',
  crudRouter({
    table: 'ck_transactions',
    label: 'Transação',
    scope: byProject,
    createSchema: s.transactionSchema,
    orderBy: [{ column: 'code' }],
    serialize: jsonbFields('informationItems', 'messages'),
    beforeWrite: (trx, req, data) => svc.assertTransactionRefs(trx, req.project.id, data),
  }),
);

export default router;
