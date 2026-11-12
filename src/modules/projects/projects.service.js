import {
  FREE_INACTIVE_MONTHS, PLANS, projectLimitOf, ROLES, sectionsOf, SECTIONS,
} from '#config/plans.js';
import { db } from '#database/connection.js';
import { PROJECT_ACCESS } from '#middlewares/loadProject.js';
import { audit } from '#services/auditLog.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';
import { crispdmService } from '#modules/crisp-dm/crispdm.service.js';
import { systemAnalysisService } from '#modules/system-analysis/systemAnalysis.service.js';

/** Data em que um projeto sem uso de um dono no Free é excluído */
export function purgeDate(lastUsedAt, months = FREE_INACTIVE_MONTHS) {
  const d = new Date(lastUsedAt);
  d.setMonth(d.getMonth() + months);
  return d;
}

const ownerIsFree = (owner) => owner?.plan === PLANS.FREE && owner?.role !== ROLES.ADMIN;

/** Cota de projetos do usuário: no Free, quantos já criou (excluir não devolve a vaga) e se pode criar outro */
export function quotaOf(account) {
  const limit = projectLimitOf(account);
  const used = Number(account?.projectsCreated ?? 0);
  return { plan: account?.plan, limit, used, canCreate: limit === null || used < limit };
}

/**
 * Seções que o usuário usa neste projeto: as do próprio plano; num projeto compartilhado, só as que também
 * estão no plano do dono; com acesso só ao Kanban, só o Kanban.
 */
export function projectSections(access, account, owner) {
  const mine = sectionsOf(account);
  if (access === PROJECT_ACCESS.OWNER || access === PROJECT_ACCESS.ADMIN) return mine;
  const ownerSections = sectionsOf(owner);
  const both = mine.filter((s) => ownerSections.includes(s));
  return access === PROJECT_ACCESS.KANBAN ? both.filter((s) => s === SECTIONS.KANBAN) : both;
}

const MEMBER_COLUMNS = ['m.id', 'm.userId', 'u.email', 'u.plan', 'm.access', 'm.createdAt', 'pr.fullName'];
const membersQuery = (projectId) =>
  db('project_members as m')
    .join('users as u', 'u.id', 'm.userId')
    .leftJoin('profiles as pr', 'pr.userId', 'm.userId')
    .where('m.projectId', projectId)
    .whereNull('u.deletedAt');

export const projectsService = {
  // Meus projetos e os compartilhados comigo (scope: all, owned, shared)
  async list(user, { page, pageSize, type, scope = 'all' }) {
    const account = await db('users').where({ id: user.id }).first('id', 'role', 'plan', 'projectsCreated');
    const q = db('projects as p')
      .join('users as o', 'o.id', 'p.ownerId')
      .leftJoin('project_members as m', function joinMember() {
        this.on('m.projectId', '=', 'p.id').andOnVal('m.userId', '=', user.id);
      })
      .whereNull('p.deletedAt');
    if (scope === 'owned') q.where('p.ownerId', user.id);
    else if (scope === 'shared') q.whereNotNull('m.id').whereNot('p.ownerId', user.id);
    else q.where((w) => w.where('p.ownerId', user.id).orWhereNotNull('m.id'));
    if (type) q.where('p.type', type);
    const [{ count }] = await q.clone().count({ count: '*' });
    const rows = await q
      .select('p.*', 'o.email as ownerEmail', 'o.plan as ownerPlan', 'o.role as ownerRole', 'm.access as memberAccess')
      .orderBy('p.updatedAt', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const data = rows.map(({ ownerPlan, ownerRole, memberAccess, ownerEmail, ...p }) => {
      const owned = p.ownerId === user.id;
      return {
        ...p,
        access: owned ? PROJECT_ACCESS.OWNER : memberAccess,
        ownerEmail: owned ? null : ownerEmail,
        // Free: o projeto é excluído depois de 3 meses sem uso
        purgeAt: ownerIsFree({ plan: ownerPlan, role: ownerRole }) ? purgeDate(p.lastUsedAt) : null,
      };
    });
    return { data, page, pageSize, total: Number(count), quota: quotaOf(account) };
  },

  async detail(req) {
    const account = await db('users').where({ id: req.user.id }).first('id', 'role', 'plan');
    const owner = await db('users').where({ id: req.project.ownerId }).first('id', 'email', 'role', 'plan');
    const access = req.projectAccess;
    return {
      ...req.project,
      access,
      ownerEmail: access === PROJECT_ACCESS.OWNER ? null : owner?.email,
      sections: projectSections(access, account, owner),
      purgeAt: ownerIsFree(owner) ? purgeDate(req.project.lastUsedAt) : null,
    };
  },

  async create(user, { type = 'software', ...data }) {
    return db.transaction(async (trx) => {
      // trava a linha do usuário: dois pedidos simultâneos não passam do limite
      const account = await trx('users').where({ id: user.id }).forUpdate().first('id', 'role', 'plan', 'projectsCreated');
      const quota = quotaOf(account);
      if (!quota.canCreate) {
        throw new AppError(
          `O plano Free permite criar até ${quota.limit} projetos (excluir um projeto não libera a vaga). Assine o Standard ou o Master para criar mais.`,
          403,
          { reason: 'project-limit', ...quota },
        );
      }
      const [project] = await trx('projects').insert({ ...data, type, ownerId: user.id }).returning('*');
      await trx('users').where({ id: user.id }).increment('projectsCreated', 1);
      if (type === 'software') await systemAnalysisService.initAnalysis(trx, project.id);
      if (type === 'data_analysis') await crispdmService.initPhases(trx, project.id);
      return project;
    });
  },

  async update(project, data) {
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    const [updated] = await db('projects').where({ id: project.id }).update(data).returning('*');
    return updated;
  },

  remove: (project) => db('projects').where({ id: project.id }).update({ deletedAt: db.fn.now() }),

  // ---------------------------------------------------------------- participantes

  async members(project) {
    const owner = await db('users as u')
      .leftJoin('profiles as pr', 'pr.userId', 'u.id')
      .where('u.id', project.ownerId)
      .first('u.id as userId', 'u.email', 'u.plan', 'pr.fullName');
    const data = await membersQuery(project.id).orderBy('m.createdAt').select(MEMBER_COLUMNS);
    return { owner, data };
  },

  async addMember(project, actorId, { email, access }) {
    const target = await db('users').where({ email, isActive: true }).whereNull('deletedAt').first('id', 'email', 'role', 'plan');
    if (!target) throw new AppError('Nenhuma conta ativa com este e-mail', 404);
    if (target.id === project.ownerId) throw new AppError('O dono já tem acesso ao projeto', 409);
    const exists = await db('project_members').where({ projectId: project.id, userId: target.id }).first('id');
    if (exists) throw new AppError('Esta pessoa já participa do projeto', 409);
    const [row] = await db('project_members')
      .insert({ projectId: project.id, userId: target.id, access, grantedBy: actorId })
      .returning('id');
    return this.member(project, row.id);
  },

  async member(project, memberId) {
    const owner = await db('users').where({ id: project.ownerId }).first('role', 'plan');
    const m = await membersQuery(project.id).where('m.id', memberId).first(MEMBER_COLUMNS);
    if (!m) throw AppError.notFound('Participante');
    // seções do projeto que o plano do participante não inclui (ele não as vê)
    const ownerSections = sectionsOf(owner);
    const theirs = sectionsOf(m);
    const blocked = m.access === PROJECT_ACCESS.KANBAN ? [] : ownerSections.filter((s) => !theirs.includes(s));
    return { ...m, blockedSections: blocked };
  },

  async updateMember(project, memberId, { access }) {
    const n = await db('project_members').where({ id: memberId, projectId: project.id }).update({ access });
    if (!n) throw AppError.notFound('Participante');
    return this.member(project, memberId);
  },

  async removeMember(project, memberId) {
    const n = await db('project_members').where({ id: memberId, projectId: project.id }).del();
    if (!n) throw AppError.notFound('Participante');
  },

  /** Free: projetos sem uso há 3 meses são excluídos (tarefa periódica) */
  async purgeInactive(now = new Date()) {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - FREE_INACTIVE_MONTHS);
    const removed = await db('projects')
      .whereNull('deletedAt')
      .where('lastUsedAt', '<', cutoff)
      .whereIn('ownerId', db('users').select('id').where({ plan: PLANS.FREE }).whereNot({ role: ROLES.ADMIN }))
      .update({ deletedAt: now })
      .returning(['id', 'ownerId', 'name']);
    for (const p of removed) {
      await audit({ userId: p.ownerId, action: 'project.purge', description: `${p.id} · sem uso há ${FREE_INACTIVE_MONTHS} meses` });
    }
    if (removed.length) logger.info({ count: removed.length }, 'Projetos do Free sem uso excluídos');
    return { removed: removed.length };
  },
};

