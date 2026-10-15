// CommonKADS (Schreiber et al., 2000) com a extensão MAS-CommonKADS para agentes.
// Cada planilha tem uma situação; as de texto livre guardam o conteúdo em `content` (jsonb) e as
// planilhas em linhas são cadastros: OM-3/TM-1 → tarefas, OM-4/TM-2 → conhecimento,
// AM-1/MAS → agentes, CM-1/CM-2 → transações.
export const MODELS = ['organization', 'task', 'agent', 'knowledge', 'communication', 'design'];

export const WORKSHEETS = [
  { key: 'om-1', model: 'organization', fields: ['problemsOpportunities', 'organizationalContext', 'solutions'] },
  { key: 'om-2', model: 'organization', fields: ['structure', 'process', 'people', 'resources', 'knowledge', 'culturePower'] },
  { key: 'om-3', model: 'organization', resource: 'tasks' },
  { key: 'om-4', model: 'organization', resource: 'knowledge' },
  { key: 'om-5', model: 'organization', fields: ['businessFeasibility', 'technicalFeasibility', 'projectFeasibility', 'proposedActions'] },
  { key: 'tm-1', model: 'task', resource: 'tasks' },
  { key: 'tm-2', model: 'task', resource: 'knowledge' },
  { key: 'am-1', model: 'agent', resource: 'agents' },
  { key: 'mas', model: 'agent', resource: 'agents' },
  // OTA-1: impactos e melhorias sobre os modelos de organização, tarefa e agente
  { key: 'ota-1', model: 'organization', fields: ['organizationImpacts', 'taskAgentImpacts', 'attitudesCommitments', 'proposedActions'] },
  {
    key: 'km-1',
    model: 'knowledge',
    fields: ['knowledgeModel', 'informationSources', 'glossary', 'componentsConsidered', 'scenarios', 'validationResults', 'elicitationMaterial'],
  },
  { key: 'cm-1', model: 'communication', resource: 'transactions' },
  { key: 'cm-2', model: 'communication', resource: 'transactions' },
  { key: 'dm-1', model: 'design', fields: ['subsystemStructure', 'controlModel', 'subsystemDecomposition', 'otherDecisions'] },
  {
    key: 'dm-2',
    model: 'design',
    fields: [
      'softwarePackage', 'potentialHardware', 'targetHardware', 'visualizationLibrary', 'languageTyping',
      'knowledgeRepresentation', 'interactionProtocols', 'controlFlow', 'commonkadsSupport',
    ],
  },
  {
    key: 'dm-3',
    model: 'design',
    fields: ['controller', 'task', 'taskMethod', 'inference', 'inferenceMethod', 'dynamicRole', 'staticRole', 'knowledgeBase', 'views'],
  },
  {
    key: 'dm-4',
    model: 'design',
    fields: ['controller', 'taskMethods', 'dynamicRoles', 'inferences', 'inferenceMethods', 'knowledgeBases', 'viewObjects'],
  },
];
export const WORKSHEET_KEYS = WORKSHEETS.map((w) => w.key);
export const WORKSHEET_STATUS = ['not_started', 'in_progress', 'completed'];

export const AGENT_KINDS = ['human', 'information_system', 'other'];

// TM-2: natureza, forma e disponibilidade do conhecimento (cada item marca se há gargalo)
export const KNOWLEDGE_NATURE = [
  'formal', 'empirical', 'heuristic', 'specialized', 'experienceBased', 'actionBased',
  'incomplete', 'uncertain', 'changing', 'hardToVerify', 'tacit',
];
export const KNOWLEDGE_FORM = ['mind', 'paper', 'electronic', 'actionSkill', 'other'];
export const KNOWLEDGE_AVAILABILITY = ['time', 'space', 'access', 'quality', 'form'];
export const CHARACTERIZATION = { nature: KNOWLEDGE_NATURE, form: KNOWLEDGE_FORM, availability: KNOWLEDGE_AVAILABILITY };

// CM-2: papel do item de informação e tipos de comunicação (força ilocucionária, tab. 9.4)
export const ITEM_ROLES = ['core', 'support'];
export const COMMUNICATION_TYPES = ['request', 'require', 'order', 'propose', 'offer', 'agree', 'reject', 'ask', 'reply', 'report', 'inform'];
