import { Router } from 'express';
import { authenticate } from '#middlewares/authenticate.js';
import { loadProject, requireProjectOwner } from '#middlewares/loadProject.js';
import { validate } from '#middlewares/validate.js';
import { audit } from '#services/auditLog.js';
import { AppError } from '#utils/AppError.js';
import crispdmRoutes from '#modules/crisp-dm/crispdm.routes.js';
import systemAnalysisRoutes from '#modules/system-analysis/systemAnalysis.routes.js';
import kanbanRoutes from '#modules/kanban/kanban.routes.js';
import ontologiesRoutes from '#modules/ontologies/ontologies.routes.js';
import bpmRoutes from '#modules/bpm/bpm.routes.js';
import commonkadsRoutes from '#modules/commonkads/commonkads.routes.js';
import fpRoutes from '#modules/function-points/fp.routes.js';
import scrumRoutes from '#modules/scrum/scrum.routes.js';
import dataDiagnosisRoutes from '#modules/data-diagnosis/dataDiagnosis.routes.js';
import { aiUsageSchema } from '#modules/data-diagnosis/dataDiagnosis.schemas.js';
import {
  addMemberSchema, createProjectSchema, listQuery, memberParams, updateMemberSchema, updateProjectSchema,
} from './projects.schemas.js';
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

// Projeto com o acesso de quem pede (owner, project, kanban ou admin) e as seções que ele usa aqui
router.get('/:projectId', loadProject(), async (req, res) => res.json(await s.detail(req)));

router.patch('/:projectId', loadProject(), requireProjectOwner, validate({ body: updateProjectSchema }), async (req, res) =>
  res.json(await s.update(req.project, req.validated.body)),
);

router.delete('/:projectId', loadProject(), requireProjectOwner, async (req, res) => {
  await s.remove(req.project);
  await audit({ userId: req.user.id, action: 'project.delete', description: req.project.id, req });
  res.status(204).end();
});

// ---------- Compartilhamento: o dono convida pelo e-mail (projeto inteiro ou só o Kanban) ----------
router.get('/:projectId/members', loadProject(), async (req, res) => res.json(await s.members(req.project)));

router.post('/:projectId/members', loadProject(), requireProjectOwner, validate({ body: addMemberSchema }), async (req, res) => {
  const member = await s.addMember(req.project, req.user.id, req.validated.body);
  await audit({ userId: req.user.id, action: 'project.share', description: `${req.project.id} · ${member.email} · ${member.access}`, req });
  res.status(201).json(member);
});

router.patch(
  '/:projectId/members/:memberId',
  validate({ params: memberParams }),
  loadProject(),
  requireProjectOwner,
  validate({ body: updateMemberSchema }),
  async (req, res) => {
    const member = await s.updateMember(req.project, req.validated.params.memberId, req.validated.body);
    await audit({ userId: req.user.id, action: 'project.share', description: `${req.project.id} · ${member.email} · ${member.access}`, req });
    res.json(member);
  },
);

// O dono remove qualquer participante; o participante pode sair do projeto
router.delete('/:projectId/members/:memberId', validate({ params: memberParams }), loadProject(), async (req, res) => {
  const { memberId } = req.validated.params;
  const isManager = req.projectAccess === 'owner' || req.projectAccess === 'admin';
  if (!isManager) {
    const self = await s.member(req.project, memberId).catch(() => null);
    if (self?.userId !== req.user.id) throw new AppError('Só o dono do projeto pode remover participantes', 403);
  }
  await s.removeMember(req.project, memberId);
  await audit({ userId: req.user.id, action: 'project.unshare', description: `${req.project.id} · ${memberId}`, req });
  res.status(204).end();
});

// Uso de IA num campo do projeto (a geração acontece no navegador, com a conta do usuário):
// fica só o registro na auditoria, sem o texto e sem a chave
router.post('/:projectId/ai-usage', loadProject(), validate({ body: aiUsageSchema }), async (req, res) => {
  const { feature, mode, provider, model } = req.validated.body;
  const via = [provider, model].filter(Boolean).join('/');
  await audit({
    userId: req.user.id,
    action: 'project.ai_text',
    description: `${req.project.id} · ${mode}${via ? ` · ${via}` : ''} · ${feature}`.slice(0, 1000),
    req,
  });
  res.status(204).end();
});

// Módulos por tipo de projeto
router.use('/:projectId/system-analysis', systemAnalysisRoutes);
router.use('/:projectId/crisp-dm', crispdmRoutes);
router.use('/:projectId/function-points', fpRoutes);
// Módulos para qualquer tipo de projeto
router.use('/:projectId/ontologies', ontologiesRoutes);
router.use('/:projectId/bpm', bpmRoutes);
router.use('/:projectId/commonkads', commonkadsRoutes);
router.use('/:projectId/scrum', scrumRoutes);
router.use('/:projectId/kanban', kanbanRoutes);
router.use('/:projectId/data-diagnosis', dataDiagnosisRoutes);

export default router;
