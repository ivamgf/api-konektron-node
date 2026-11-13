import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { TEMPLATES, templateSummary } from './templates/index.js';

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

  listTemplates() {
    return Object.values(TEMPLATES).map(templateSummary);
  },

  /**
   * Aplica um modelo ao projeto sem apagar nada: preenche só os campos vazios da análise e cria os
   * requisitos e histórias com códigos ainda livres e os diagramas com títulos ainda livres. Aplicar
   * de novo não duplica. As histórias ficam ligadas aos requisitos do projeto pelo código.
   */
  async applyTemplate(project, key) {
    const tpl = TEMPLATES[key];
    if (!tpl) throw AppError.notFound('Modelo');
    const projectId = project.id;
    const fill = (text) => (text == null ? text : text.replaceAll('{projeto}', () => project.name)); // função: "$&" no nome não vira padrão
    const tally = (total, created) => ({ created, skipped: total - created });

    return db.transaction(async (trx) => {
      // Análise: o que a pessoa já escreveu fica
      const current = await trx('system_analyses').where({ projectId }).first(...ANALYSIS_FIELDS);
      const analysis = Object.fromEntries(
        ANALYSIS_FIELDS.filter((f) => tpl.analysis[f] && !current?.[f]?.trim()).map((f) => [f, fill(tpl.analysis[f])]),
      );
      if (Object.keys(analysis).length) {
        await trx('system_analyses').insert({ projectId, ...analysis }).onConflict('projectId').merge(Object.keys(analysis));
      }

      // Requisitos (código único no projeto)
      const reqIds = new Map(
        (await trx('requirements').where({ projectId }).select('id', 'code')).map((r) => [r.code, r.id]),
      );
      const newReqs = tpl.requirements
        .filter((r) => !reqIds.has(r.code))
        .map((r) => ({ ...r, description: fill(r.description), projectId }));
      if (newReqs.length) {
        for (const r of await trx('requirements').insert(newReqs).returning(['id', 'code'])) reqIds.set(r.code, r.id);
      }

      // Histórias / casos de uso (código único no projeto)
      const storyCodes = new Set(await trx('user_stories').where({ projectId }).pluck('code'));
      const newStories = tpl.userStories
        .filter((s) => !storyCodes.has(s.code))
        .map(({ requirementCode, ...s }) => ({ ...s, requirementId: reqIds.get(requirementCode) ?? null, projectId }));
      if (newStories.length) await trx('user_stories').insert(newStories);

      // Diagramas (pelo título)
      const titles = new Set(await trx('diagrams').where({ projectId }).pluck('title'));
      const newDiagrams = tpl.diagrams
        .filter((d) => !titles.has(d.title))
        .map((d) => ({ ...d, description: fill(d.description), projectId }));
      if (newDiagrams.length) await trx('diagrams').insert(newDiagrams);

      return {
        template: templateSummary(tpl),
        analysis: { filled: Object.keys(analysis) },
        requirements: tally(tpl.requirements.length, newReqs.length),
        userStories: tally(tpl.userStories.length, newStories.length),
        diagrams: tally(tpl.diagrams.length, newDiagrams.length),
      };
    });
  },

  // Garante que um requisito referenciado pertence ao mesmo projeto
  async assertRequirementInProject(trx, projectId, requirementId) {
    if (!requirementId) return;
    const found = await trx('requirements').where({ id: requirementId, projectId }).first('id');
    if (!found) throw new AppError('Requisito não pertence a este projeto', 422);
  },
};
