import { z } from 'zod';
import { isMasterAdmin } from '#config/plans.js';
import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';

// Carrega req.project a partir de :projectId, garantindo dono (ou administrador Master) e tipo opcional
export const loadProject =
  ({ type } = {}) =>
  async (req, _res, next) => {
    const { projectId } = req.params;
    if (!z.uuid().safeParse(projectId).success) throw AppError.notFound('Projeto');

    const project = await db('projects').where({ id: projectId }).whereNull('deletedAt').first();
    if (!project || (project.ownerId !== req.user.id && !isMasterAdmin(req.user))) {
      throw AppError.notFound('Projeto');
    }
    if (type && project.type !== type) {
      throw new AppError(`Este recurso exige um projeto do tipo "${type}"`, 409);
    }
    req.project = project;
    next();
  };
