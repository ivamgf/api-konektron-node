import { z } from 'zod';

// Diagnóstico de dados: três documentos por projeto, cada um com as seções do seu modelo em `content`.
// Os documentos são rascunhos editados aos poucos: quase tudo é opcional e as listas de opções aceitam
// '' (ainda não escolhido). Os valores dos enums são as chaves usadas pelo app (traduzidas lá).

// ---------- Enums ----------
export const CRITICALITY = ['high', 'medium', 'low'];
export const LEVEL3 = ['high', 'medium', 'low']; // probabilidade, impacto, severidade, esforço
export const YES_NO = ['yes', 'no', 'unknown'];
export const DOCUMENTATION = ['yes', 'partial', 'no', 'unknown'];
export const CLASSIFICATION = ['public', 'internal', 'confidential'];
export const SOURCE_TYPES = ['relational', 'nosql', 'api', 'file', 'saas', 'data_lake', 'iot', 'external', 'other'];
export const FLOW_METHODS = ['etl', 'api', 'replication', 'file_transfer', 'manual', 'streaming', 'other'];
export const INTEGRATION_METHODS = ['api', 'etl', 'file', 'direct_db', 'manual', 'other'];
export const VENDOR_TYPES = ['commercial', 'in_house', 'outsourced', 'public', 'other'];
export const HOSTING = ['on_premise', 'own_cloud', 'vendor_cloud', 'user_machine', 'other'];
export const SYSTEM_STATUS = ['production', 'implementation', 'legacy', 'decommissioning'];
export const ACTION_STATUS = ['not_started', 'in_progress', 'done', 'late', 'blocked'];
// Bases legais da LGPD (art. 7º para dados pessoais; art. 11 para sensíveis)
export const LEGAL_BASES = [
  'consent', 'legal_obligation', 'public_policy', 'research', 'contract', 'legal_process',
  'life_protection', 'health', 'legitimate_interest', 'credit_protection', 'other',
];
export const RACI = ['R', 'A', 'C', 'I'];
// Avaliação de maturidade (rubrica de 5 níveis inspirada no CMMI DMM e no DAMA-DMBOK)
export const MATURITY_DIMENSIONS = ['sources', 'flows', 'quality', 'governance', 'usage'];
export const GOVERNANCE_ITEMS = ['roles', 'dictionary', 'accessPolicies', 'encryption', 'auditTrail', 'backup', 'retention'];
export const PLAN_PHASES = ['planning', 'analysis', 'migration', 'testing', 'training', 'golive', 'post'];
export const GOLIVE_ITEMS = [
  'homologation', 'dataReconciled', 'integrationsTested', 'accessProfiles', 'usersTrained',
  'rollback', 'supportReady', 'cutoverNotice', 'goLiveDecision',
];
export const INVENTORY_STEPS = ['validateOwners', 'readAccess', 'collectDocs', 'consolidate'];

// ---------- Blocos ----------
const str = (max = 500) => z.string().max(max).optional();
const text = (max = 20_000) => z.string().max(max).optional();
const pick = (values) => z.union([z.enum(values), z.literal('')]).optional();
const date = z.union([z.iso.date(), z.literal('')]).optional();
const score = z.number().int().min(1).max(5).nullable().optional();
const rows = (shape, max = 300) => z.array(z.object(shape)).max(max).optional();
const checks = (keys, extra = {}) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.object({ done: z.boolean().optional(), ...extra }).optional()]))).optional();
const code = str(20);

// ---------- Inventário preliminar das bases e sistemas ----------
export const inventoryContentSchema = z.object({
  identification: z
    .object({
      organization: str(300),
      responsible: str(300),
      sources: str(1000),
      relatedProject: str(300),
      periodStart: date,
      periodEnd: date,
    })
    .optional(),
  systems: rows({
    code,
    name: str(200),
    purpose: str(1000),
    userAreas: str(500),
    vendorType: pick(VENDOR_TYPES),
    vendor: str(300),
    hosting: pick(HOSTING),
    users: z.number().int().min(0).max(10_000_000).nullable().optional(),
    businessOwner: str(200),
    technicalOwner: str(200),
    status: pick(SYSTEM_STATUS),
    criticality: pick(CRITICALITY),
  }),
  databases: rows({
    code,
    name: str(200),
    systemCode: str(100),
    technology: str(200),
    location: str(300),
    volume: str(50),
    contents: str(1000),
    personalData: pick(YES_NO),
    backup: str(200),
    documentation: pick(DOCUMENTATION),
    owner: str(200),
  }),
  integrations: rows({
    code,
    origin: str(200),
    destination: str(200),
    transferred: str(1000),
    method: pick(INTEGRATION_METHODS),
    frequency: str(100),
    owner: str(200),
  }),
  pending: rows({ itemCode: str(50), question: str(1000), whoCanAnswer: str(300), dueDate: date }),
  nextSteps: checks(INVENTORY_STEPS),
  notes: text(),
});

// ---------- Relatório de diagnóstico das fontes e fluxos de dados ----------
const dimensionSchema = z.object({
  level: score.describe('Nível atual (1 Inicial … 5 Otimizado), só se todos os critérios dos níveis anteriores forem cumpridos'),
  target: score.describe('Nível-alvo; a distância até o atual alimenta o plano de ação'),
  weight: z.number().min(0).max(10).optional().describe('Peso na nota consolidada (média ponderada)'),
  evidence: text(5000),
});

export const reportContentSchema = z.object({
  identification: z
    .object({
      organization: str(300),
      area: str(300),
      responsible: str(300),
      sponsor: str(300),
      team: str(1000),
      periodStart: date,
      periodEnd: date,
      classification: pick(CLASSIFICATION),
    })
    .optional(),
  revisions: rows({ version: str(20), date, author: str(200), changes: str(1000) }, 100),
  summary: z
    .object({ executiveSummary: text(), keyFindings: text(), priorityRecommendations: text() })
    .optional(),
  scope: z
    .object({
      objective: text(),
      included: text(),
      excluded: text(),
      documentary: text(5000),
      interviews: text(5000),
      technical: text(5000),
      quality: text(5000),
      validation: text(5000),
      assumptions: text(),
    })
    .optional(),
  sources: rows({
    code,
    name: str(200),
    type: pick(SOURCE_TYPES),
    technology: str(200),
    ownerArea: str(200),
    technicalOwner: str(200),
    volume: str(50),
    update: str(100),
    personalData: pick(YES_NO),
    criticality: pick(CRITICALITY),
    documented: pick(DOCUMENTATION),
  }),
  flows: rows({
    code,
    origin: str(200),
    destination: str(200),
    data: str(500),
    method: pick(FLOW_METHODS),
    frequency: str(100),
    format: str(100),
    owner: str(200),
    monitored: pick(YES_NO),
  }),
  flowNotes: text(),
  quality: rows({
    sourceCode: str(100),
    completeness: score,
    accuracy: score,
    consistency: score,
    timeliness: score,
    uniqueness: score,
    validity: score,
    evidence: str(2000),
  }),
  governance: checks(GOVERNANCE_ITEMS, { situation: str(2000) }),
  personalData: rows({
    sourceCode: str(100),
    categories: str(500),
    sensitive: pick(YES_NO),
    legalBasis: pick(LEGAL_BASES),
    sharedWith: str(500),
    notes: str(1000),
  }),
  problems: rows({
    code,
    problem: str(2000),
    affected: str(200),
    impact: str(1000),
    probability: pick(LEVEL3),
    severity: pick(LEVEL3),
    evidence: str(1000),
  }),
  actions: rows({
    action: str(2000),
    problems: str(200),
    impact: pick(LEVEL3),
    effort: pick(LEVEL3),
    dueDate: date,
    owner: str(200),
    status: pick(ACTION_STATUS),
  }),
  maturity: z
    .object({
      ...Object.fromEntries(MATURITY_DIMENSIONS.map((d) => [d, dimensionSchema.optional()])),
      validatedAt: date.describe('Reunião de validação das notas com as áreas'),
      notes: text(),
    })
    .optional(),
  conclusion: text(),
  glossary: rows({ term: str(200), definition: str(2000) }, 200),
  annexes: text(),
});

// ---------- Plano de trabalho para implantação de sistema ----------
export const planContentSchema = z.object({
  identification: z
    .object({
      summary: text(2000),
      system: str(300),
      areas: str(500),
      sponsor: str(300),
      manager: str(300),
      startDate: date,
      endDate: date,
      budget: z.number().min(0).max(1e12).nullable().optional(),
      replacedSystems: str(500),
      references: str(1000),
    })
    .optional(),
  scope: z
    .object({
      objective: text(),
      modules: text(5000),
      areas: text(5000),
      integrations: text(5000),
      dataMigration: text(5000),
      training: text(5000),
      excluded: text(),
      assumptions: text(),
      constraints: text(),
    })
    .optional(),
  phases: z
    .object(
      Object.fromEntries(
        PLAN_PHASES.map((p) => [p, z.object({ start: date, end: date, deliverable: str(500) }).optional()]),
      ),
    )
    .optional(),
  activities: rows({
    code: str(20),
    phase: pick(PLAN_PHASES),
    activity: str(500),
    deliverable: str(500),
    owner: str(200),
    start: date,
    end: date,
    dependsOn: str(100),
    status: pick(ACTION_STATUS),
  }),
  team: rows({ role: str(200), name: str(200), area: str(200), dedication: str(50), responsibilities: str(1000) }, 100),
  raci: rows(
    {
      deliverable: str(200),
      sponsor: pick(RACI),
      manager: pick(RACI),
      keyUsers: pick(RACI),
      it: pick(RACI),
      vendor: pick(RACI),
    },
    100,
  ),
  risks: rows({
    code,
    risk: str(1000),
    probability: pick(LEVEL3),
    impact: pick(LEVEL3),
    response: str(2000),
    owner: str(200),
    trigger: str(500),
  }),
  communication: rows(
    { meeting: str(200), participants: str(500), frequency: str(100), objective: str(1000), record: str(200) },
    100,
  ),
  changeControl: text(),
  statusReport: text(),
  acceptanceCriteria: text(),
  goLive: checks(GOLIVE_ITEMS),
  approvals: rows({ role: str(200), name: str(200), date }, 50),
});

// ---------- Corpos das rotas ----------
const docFields = {
  title: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(20).optional(),
};

export const inventorySchema = z.object({ ...docFields, content: inventoryContentSchema.optional() });
export const reportSchema = z.object({ ...docFields, content: reportContentSchema.optional() });
export const planSchema = z.object({ ...docFields, content: planContentSchema.optional() });

// Auditoria do uso de IA nos campos de texto (sem o texto e sem a chave do usuário)
export const AI_MODES = ['api', 'assistant'];
export const aiUsageSchema = z.object({
  feature: z.string().trim().min(1).max(120).describe('Campo ou recurso (ex.: "Gerar: Descrição")'),
  mode: z.enum(AI_MODES).describe('api = conta do usuário chamada pelo navegador; assistant = chat na web'),
  provider: z.string().trim().max(40).nullable().optional(),
  model: z.string().trim().max(100).nullable().optional(),
});
