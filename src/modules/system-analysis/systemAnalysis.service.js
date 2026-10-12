import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';

const ANALYSIS_FIELDS = ['goal', 'scope', 'technicalDescription', 'notes'];
const EMPTY_ANALYSIS = Object.fromEntries(ANALYSIS_FIELDS.map((f) => [f, null]));

const countBy = async (table, projectId, column) => {
  const rows = await db(table).where({ projectId }).select(column).count({ n: '*' }).groupBy(column);
  return Object.fromEntries(rows.map((r) => [r[column], r.n]));
};
const sum = (counts) => Object.values(counts).reduce((a, b) => a + b, 0);

export const systemAnalysisService = {
  // Chamado na criação de um projeto software
  initAnalysis(trx, projectId) {
    return trx('system_analyses').insert({ projectId });
  },

  async getAnalysis(projectId) {
    const row = await db('system_analyses').where({ projectId }).first(...ANALYSIS_FIELDS, 'updatedAt');
    return row ?? { ...EMPTY_ANALYSIS, updatedAt: null };
  },

  async updateAnalysis(projectId, data) {
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    // upsert: cobre projetos criados antes da seção existir
    const [row] = await db('system_analyses')
      .insert({ projectId, ...data })
      .onConflict('projectId')
      .merge(Object.keys(data))
      .returning([...ANALYSIS_FIELDS, 'updatedAt']);
    return row;
  },

  // Visão geral para o dashboard do projeto
  async overview(project) {
    const projectId = project.id;
    const [analysis, requirementsByType, requirementsByStatus, storiesByStatus, diagramsByType] =
      await Promise.all([
        this.getAnalysis(projectId),
        countBy('requirements', projectId, 'type'),
        countBy('requirements', projectId, 'status'),
        countBy('user_stories', projectId, 'status'),
        countBy('diagrams', projectId, 'type'),
      ]);

    return {
      project: { id: project.id, name: project.name, version: project.version },
      analysis,
      counts: {
        requirements: { total: sum(requirementsByType), byType: requirementsByType, byStatus: requirementsByStatus },
        userStories: { total: sum(storiesByStatus), byStatus: storiesByStatus },
        diagrams: { total: sum(diagramsByType), byType: diagramsByType },
      },
    };
  },

  // Documento completo (base para relatório/PDF no front — RF6)
  async report(project) {
    const projectId = project.id;
    const [analysis, requirements, userStories, diagrams] = await Promise.all([
      this.getAnalysis(projectId),
      db('requirements').where({ projectId }).orderBy([{ column: 'type' }, { column: 'code' }]),
      db('user_stories').where({ projectId }).orderBy('code'),
      db('diagrams').where({ projectId }).orderBy([{ column: 'type' }, { column: 'title' }]),
    ]);

    // Rastreabilidade: cada requisito com as histórias que o refinam
    const storiesByRequirement = Object.groupBy(userStories, (s) => s.requirementId ?? 'none');

    return {
      generatedAt: new Date().toISOString(),
      project,
      analysis,
      requirements: requirements.map((r) => ({
        ...r,
        userStories: (storiesByRequirement[r.id] ?? []).map((s) => s.code),
      })),
      userStories,
      diagrams,
    };
  },

  // Garante que um requisito referenciado pertence ao mesmo projeto
  async assertRequirementInProject(trx, projectId, requirementId) {
    if (!requirementId) return;
    const found = await trx('requirements').where({ id: requirementId, projectId }).first('id');
    if (!found) throw new AppError('Requisito não pertence a este projeto', 422);
  },
};
