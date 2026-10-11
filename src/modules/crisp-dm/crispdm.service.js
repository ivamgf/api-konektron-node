import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { PHASES, PHASE_KEYS } from './crispdm.constants.js';
import { PHASE_CONTENT_SCHEMAS } from './crispdm.schemas.js';

const META = Object.fromEntries(PHASES.map((p) => [p.key, p]));
const withMeta = (row) => {
  const { order, label, tasks } = META[row.phase];
  return { ...row, order, label, tasks };
};

export const crispdmService = {
  // Chamado na criação de um projeto data_analysis
  initPhases(trx, projectId) {
    return trx('crispdm_phases').insert(PHASE_KEYS.map((phase) => ({ projectId, phase })));
  },

  async listPhases(projectId) {
    const rows = await db('crispdm_phases').where({ projectId }).orderBy('phase');
    return rows.map(withMeta);
  },

  async getPhase(projectId, phase) {
    const row = await db('crispdm_phases').where({ projectId, phase }).first();
    if (!row) throw AppError.notFound('Fase');
    return withMeta(row);
  },

  async updatePhase(projectId, phase, { status, notes, content }) {
    const patch = {};
    if (notes !== undefined) patch.notes = notes;

    if (content !== undefined) {
      const parsed = PHASE_CONTENT_SCHEMAS[phase].parse(content); // ZodError -> 422
      // merge: só sobrescreve as tarefas enviadas
      patch.content = db.raw('content || ?::jsonb', [JSON.stringify(parsed)]);
    }

    if (status) {
      patch.status = status;
      if (status === 'not_started') Object.assign(patch, { startedAt: null, completedAt: null });
      if (status === 'in_progress') Object.assign(patch, { startedAt: db.raw('coalesce(started_at, now())'), completedAt: null });
      if (status === 'completed') Object.assign(patch, { startedAt: db.raw('coalesce(started_at, now())'), completedAt: db.fn.now() });
    }

    if (!Object.keys(patch).length) throw new AppError('Nenhum campo para atualizar', 400);
    const [row] = await db('crispdm_phases').where({ projectId, phase }).update(patch).returning('*');
    if (!row) throw AppError.notFound('Fase');
    return withMeta(row);
  },

  // Visão geral para o dashboard do projeto
  async overview(project) {
    const projectId = project.id;
    const count = (table, extra = {}) =>
      db(table).where({ projectId, ...extra }).count({ n: '*' }).then(([r]) => Number(r.n));

    const [phases, objectives, datasets, preparationSteps, models, approvedModels] = await Promise.all([
      this.listPhases(projectId),
      count('crispdm_objectives'),
      count('crispdm_datasets'),
      count('crispdm_preparation_steps'),
      count('crispdm_models'),
      db('crispdm_models').where({ projectId }).whereIn('status', ['approved', 'deployed'])
        .count({ n: '*' }).then(([r]) => Number(r.n)),
    ]);

    const completed = phases.filter((p) => p.status === 'completed').length;
    const current = phases.find((p) => p.status === 'in_progress') ?? phases.find((p) => p.status === 'not_started');

    return {
      project: { id: project.id, name: project.name, version: project.version },
      progress: Math.round((completed / phases.length) * 100),
      currentPhase: current?.phase ?? null,
      phases: phases.map(({ phase, status, order, label, startedAt, completedAt }) => ({
        phase, status, order, label, startedAt, completedAt,
      })),
      counts: { objectives, datasets, preparationSteps, models, approvedModels },
    };
  },

  // Documento completo do projeto (base para relatório/PDF no front — RF6)
  async report(project) {
    const projectId = project.id;
    const [phases, objectives, datasets, steps, models] = await Promise.all([
      this.listPhases(projectId),
      db('crispdm_objectives').where({ projectId }).orderBy([{ column: 'type' }, { column: 'priority' }]),
      db('crispdm_datasets').where({ projectId }).orderBy('name'),
      db('crispdm_preparation_steps').where({ projectId }).orderBy('stepOrder'),
      db('crispdm_models').where({ projectId }).orderBy('createdAt'),
    ]);

    const [fields, metrics] = await Promise.all([
      datasets.length
        ? db('crispdm_dataset_fields').whereIn('datasetId', datasets.map((d) => d.id)).orderBy('name')
        : [],
      models.length
        ? db('crispdm_model_metrics').whereIn('modelId', models.map((m) => m.id)).orderBy('metric')
        : [],
    ]);
    const fieldsByDataset = Object.groupBy(fields, (f) => f.datasetId);
    const metricsByModel = Object.groupBy(metrics, (m) => m.modelId);

    return {
      generatedAt: new Date().toISOString(),
      project,
      phases,
      objectives,
      datasets: datasets.map((d) => ({ ...d, fields: fieldsByDataset[d.id] ?? [] })),
      preparationSteps: steps,
      models: models.map((m) => ({ ...m, metrics: metricsByModel[m.id] ?? [] })),
    };
  },

  // Garante que um dataset referenciado pertence ao mesmo projeto
  async assertDatasetInProject(trx, projectId, datasetId) {
    if (!datasetId) return;
    const ds = await trx('crispdm_datasets').where({ id: datasetId, projectId }).first('id');
    if (!ds) throw new AppError('Dataset não pertence a este projeto', 422);
  },
};
