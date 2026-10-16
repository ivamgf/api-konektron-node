import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { crispdmService } from '#modules/crisp-dm/crispdm.service.js';
import { systemAnalysisService } from '#modules/system-analysis/systemAnalysis.service.js';

const owned = (user) => db('projects').where({ ownerId: user.id }).whereNull('deletedAt');

export const projectsService = {
  async list(user, { page, pageSize, type }) {
    const q = owned(user);
    if (type) q.where({ type });
    const [{ count }] = await q.clone().count({ count: '*' });
    const data = await q.orderBy('updatedAt', 'desc').limit(pageSize).offset((page - 1) * pageSize);
    return { data, page, pageSize, total: Number(count) };
  },

  async create(user, { type = 'software', ...data }) {
    return db.transaction(async (trx) => {
      const [project] = await trx('projects').insert({ ...data, type, ownerId: user.id }).returning('*');
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
};
