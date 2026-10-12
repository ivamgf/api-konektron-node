import { db } from '#database/connection.js';
import { systemAnalysisService } from '#modules/system-analysis/systemAnalysis.service.js';
import { AppError } from '#utils/AppError.js';
import { buildFeatures, draftScenarios } from './gherkin.js';

const SPEC_FIELDS = [
  'responsible', 'organization', 'purpose', 'productPerspective', 'userCharacteristics',
  'constraints', 'assumptions', 'references',
];
const EMPTY_SPEC = Object.fromEntries(SPEC_FIELDS.map((f) => [f, null]));
const invalid = (field, message) => new AppError('Dados inválidos', 422, { [field]: [message] });

export const systemViewService = {
  // ---------- Definições ----------
  async getSpec(projectId) {
    const row = await db('system_specs').where({ projectId }).first(...SPEC_FIELDS, 'updatedAt');
    return row ?? { ...EMPTY_SPEC, updatedAt: null };
  },

  async updateSpec(projectId, data) {
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    const [row] = await db('system_specs')
      .insert({ projectId, ...data })
      .onConflict('projectId')
      .merge(Object.keys(data))
      .returning([...SPEC_FIELDS, 'updatedAt']);
    return row;
  },

  // ---------- Validações de vínculo (sempre dentro do mesmo projeto) ----------
  async assertInProject(trx, table, projectId, id, field) {
    if (id == null) return;
    const row = await trx(table).where({ id, projectId }).first('id');
    if (!row) throw invalid(field, 'Registro não encontrado neste projeto');
  },

  async assertRequirements(trx, projectId, ids) {
    if (!ids?.length) return;
    const found = await trx('requirements').where({ projectId }).whereIn('id', ids).pluck('id');
    if (found.length !== new Set(ids).size) throw invalid('requirementIds', 'Há requisitos que não pertencem a este projeto');
  },

  // Generalização: o caso de uso geral é do projeto e não forma ciclo (A → B → A)
  async assertGeneral(trx, projectId, generalId, selfId) {
    if (generalId == null) return;
    if (generalId === selfId) throw invalid('generalUseCaseId', 'Um caso de uso não pode especializar a si mesmo');
    await this.assertInProject(trx, 'use_cases', projectId, generalId, 'generalUseCaseId');
    let current = generalId;
    for (let i = 0; current && i < 100; i++) {
      const row = await trx('use_cases').where({ id: current }).first('generalUseCaseId');
      current = row?.generalUseCaseId;
      if (current === selfId) throw invalid('generalUseCaseId', 'A generalização formaria um ciclo');
    }
  },

  async assertSingleMain(trx, useCaseId, data, flowId) {
    if (data.kind !== 'main') return;
    const q = trx('use_case_flows').where({ useCaseId, kind: 'main' });
    if (flowId) q.whereNot({ id: flowId });
    const other = await q.first('id');
    if (other) throw invalid('kind', 'Este caso de uso já tem um cenário principal');
  },

  // ---------- Leitura ----------
  async useCaseDetail(projectId, id) {
    const useCase = await db('use_cases').where({ id, projectId }).first();
    if (!useCase) throw AppError.notFound('Caso de uso');
    const [flows, relations] = await Promise.all([
      db('use_case_flows').where({ useCaseId: id }).orderBy(['position', 'createdAt']),
      db('use_case_relations').where({ projectId }).where((q) => q.where({ fromUseCaseId: id }).orWhere({ toUseCaseId: id })),
    ]);
    return { ...useCase, flows, relations };
  },

  async overview(project) {
    const projectId = project.id;
    const [useCases, flows, requirements, stories, scenarios, stakeholders, glossary] = await Promise.all([
      db('use_cases').where({ projectId }).select('id', 'requirementIds', 'status'),
      db('use_case_flows').join('use_cases', 'use_cases.id', 'use_case_flows.use_case_id')
        .where('use_cases.project_id', projectId).select('use_case_flows.use_case_id as useCaseId', 'use_case_flows.kind'),
      db('requirements').where({ projectId }).select('id', 'code', 'type'),
      db('user_stories').where({ projectId }).select('id', 'code'),
      db('bdd_scenarios').where({ projectId }).select('userStoryId'),
      db('stakeholders').where({ projectId }).count({ n: '*' }).first(),
      db('glossary_terms').where({ projectId }).count({ n: '*' }).first(),
    ]);
    const covered = new Set(useCases.flatMap((u) => u.requirementIds ?? []));
    const withMain = new Set(flows.filter((f) => f.kind === 'main').map((f) => f.useCaseId));
    const withScenario = new Set(scenarios.map((s) => s.userStoryId).filter(Boolean));
    const functional = requirements.filter((r) => r.type === 'functional');
    return {
      counts: {
        stakeholders: stakeholders.n,
        glossary: glossary.n,
        useCases: useCases.length,
        scenarios: scenarios.length,
        requirements: requirements.length,
        userStories: stories.length,
      },
      // lacunas de rastreabilidade, para o analista completar a especificação
      gaps: {
        functionalWithoutUseCase: functional.filter((r) => !covered.has(r.id)).map((r) => r.code),
        useCasesWithoutMainFlow: useCases.filter((u) => !withMain.has(u.id)).length,
        storiesWithoutScenario: stories.filter((s) => !withScenario.has(s.id)).map((s) => s.code),
      },
    };
  },

  // Documento de especificação completo (versão UML), base do relatório/PDF no app
  async report(project) {
    const projectId = project.id;
    const [analysis, spec, stakeholders, glossary, requirements, useCases, flows, relations, diagrams, stories, scenarios] =
      await Promise.all([
        systemAnalysisService.getAnalysis(projectId),
        this.getSpec(projectId),
        db('stakeholders').where({ projectId }).orderBy('code'),
        db('glossary_terms').where({ projectId }).orderBy('term'),
        db('requirements').where({ projectId }).orderBy([{ column: 'type' }, { column: 'code' }]),
        db('use_cases').where({ projectId }).orderBy('code'),
        db('use_case_flows').join('use_cases', 'use_cases.id', 'use_case_flows.use_case_id')
          .where('use_cases.project_id', projectId).select('use_case_flows.*').orderBy(['use_case_flows.position', 'use_case_flows.created_at']),
        db('use_case_relations').where({ projectId }),
        db('diagrams').where({ projectId, type: 'use_case' }).orderBy('title'),
        db('user_stories').where({ projectId }).orderBy('code'),
        db('bdd_scenarios').where({ projectId }).orderBy(['position', 'createdAt']),
      ]);
    const flowsByUseCase = Object.groupBy(flows, (f) => f.useCaseId);
    return {
      generatedAt: new Date().toISOString(),
      project,
      analysis,
      spec,
      stakeholders,
      glossary,
      requirements,
      useCases: useCases.map((u) => ({ ...u, flows: flowsByUseCase[u.id] ?? [] })),
      relations,
      diagrams,
      userStories: stories,
      scenarios,
    };
  },

  // ---------- BDD ----------
  async features(projectId, lang) {
    const [stories, scenarios] = await Promise.all([
      db('user_stories').where({ projectId }).orderBy('code'),
      db('bdd_scenarios').where({ projectId }).orderBy(['position', 'createdAt']),
    ]);
    return buildFeatures({ stories, scenarios }, lang);
  },

  // Cria cenários a partir dos fluxos do caso de uso; os que já existem (mesmo título) são mantidos
  async generateScenarios(projectId, useCaseId, { lang, userStoryId }) {
    const detail = await this.useCaseDetail(projectId, useCaseId);
    if (!detail.flows.length) throw new AppError('Cadastre os cenários do caso de uso antes de gerar o BDD', 409);
    return db.transaction(async (trx) => {
      await this.assertInProject(trx, 'user_stories', projectId, userStoryId, 'userStoryId');
      const existing = new Set(await trx('bdd_scenarios').where({ projectId, useCaseId }).pluck('title'));
      const drafts = draftScenarios(detail, detail.flows, lang).filter((d) => !existing.has(d.title));
      if (!drafts.length) return [];
      const start = await trx('bdd_scenarios').where({ projectId }).max({ max: 'position' }).first();
      const base = start?.max == null ? 0 : start.max + 1;
      return trx('bdd_scenarios')
        .insert(drafts.map((d, i) => ({ ...d, projectId, userStoryId: userStoryId ?? null, position: base + i })))
        .returning('*');
    });
  },
};
