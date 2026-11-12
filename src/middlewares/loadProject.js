import { z } from 'zod';
import { canAccessSection, isMasterAdmin, SECTIONS } from '#config/plans.js';
import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { planError } from './authorize.js';

// Acesso ao projeto: owner (dono), admin (administrador Master), project (participante do projeto
// inteiro) ou kanban (participante só do Kanban)
export const PROJECT_ACCESS = Object.freeze({ OWNER: 'owner', ADMIN: 'admin', PROJECT: 'project', KANBAN: 'kanban' });

// O último uso só é gravado de hora em hora (evita um UPDATE a cada requisição)
const TOUCH_MS = 3_600_000;
async function touch(project) {
  if (Date.now() - new Date(project.lastUsedAt).getTime() < TOUCH_MS) return;
  await db('projects').where({ id: project.id }).update({ lastUsedAt: db.fn.now() });
}

/**
 * Carrega req.project a partir de :projectId e define req.projectAccess. Entram o dono, o administrador
 * Master e os participantes convidados pelo dono. Numa seção (req.section, vindo do requireSection),
 * o participante só entra se a seção também estiver no plano do dono, e quem tem acesso só ao Kanban
 * só entra no Kanban.
 */
export const loadProject =
  ({ type } = {}) =>
  async (req, _res, next) => {
    const { projectId } = req.params;
    if (!z.uuid().safeParse(projectId).success) throw AppError.notFound('Projeto');

    const project = await db('projects').where({ id: projectId }).whereNull('deletedAt').first();
    if (!project) throw AppError.notFound('Projeto');

    let access;
    if (project.ownerId === req.user.id) access = PROJECT_ACCESS.OWNER;
    else {
      const member = await db('project_members').where({ projectId, userId: req.user.id }).first('access');
      if (member) access = member.access;
      else if (isMasterAdmin(req.user)) access = PROJECT_ACCESS.ADMIN;
      else throw AppError.notFound('Projeto');
    }

    if (req.section && (access === PROJECT_ACCESS.PROJECT || access === PROJECT_ACCESS.KANBAN)) {
      if (access === PROJECT_ACCESS.KANBAN && req.section !== SECTIONS.KANBAN) {
        throw new AppError('Você tem acesso só ao Kanban deste projeto', 403, { section: req.section, reason: 'kanban-only' });
      }
      const owner = await db('users').where({ id: project.ownerId }).first('role', 'plan');
      if (!canAccessSection(owner, req.section)) throw planError(req.section, 'owner');
    }
    if (type && project.type !== type) {
      throw new AppError(`Este recurso exige um projeto do tipo "${type}"`, 409);
    }
    if (access !== PROJECT_ACCESS.ADMIN) await touch(project);
    req.project = project;
    req.projectAccess = access;
    next();
  };

// Só o dono (ou o administrador Master) altera, exclui ou compartilha o projeto
export function requireProjectOwner(req, _res, next) {
  if (req.projectAccess === PROJECT_ACCESS.OWNER || req.projectAccess === PROJECT_ACCESS.ADMIN) return next();
  next(new AppError('Só o dono do projeto pode fazer isto', 403));
}
