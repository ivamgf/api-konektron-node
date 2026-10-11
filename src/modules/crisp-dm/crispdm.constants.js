// CRISP-DM — Cross-Industry Standard Process for Data Mining
// As tarefas de cada fase seguem o guia de referência CRISP-DM 1.0 e viram campos de `content`.
export const PHASES = Object.freeze([
  {
    key: 'business_understanding',
    order: 1,
    label: { en: 'Business Understanding', 'pt-BR': 'Entendimento do Negócio' },
    tasks: [
      'background', 'businessSuccessCriteria', 'inventoryOfResources', 'requirements',
      'assumptions', 'constraints', 'risksAndContingencies', 'terminology',
      'costsAndBenefits', 'projectPlan', 'initialToolsAssessment',
    ],
  },
  {
    key: 'data_understanding',
    order: 2,
    label: { en: 'Data Understanding', 'pt-BR': 'Entendimento dos Dados' },
    tasks: [
      'initialDataCollectionReport', 'dataDescriptionReport',
      'dataExplorationReport', 'dataQualityReport',
    ],
  },
  {
    key: 'data_preparation',
    order: 3,
    label: { en: 'Data Preparation', 'pt-BR': 'Preparação dos Dados' },
    tasks: [
      'rationaleForInclusionExclusion', 'dataCleaningReport', 'derivedAttributes',
      'generatedRecords', 'mergedData', 'reformattedData', 'datasetDescription',
    ],
  },
  {
    key: 'modeling',
    order: 4,
    label: { en: 'Modeling', 'pt-BR': 'Modelagem' },
    tasks: [
      'modelingTechnique', 'modelingAssumptions', 'testDesign',
      'parameterSettings', 'modelDescription', 'modelAssessment',
    ],
  },
  {
    key: 'evaluation',
    order: 5,
    label: { en: 'Evaluation', 'pt-BR': 'Avaliação' },
    tasks: ['assessmentOfResults', 'approvedModels', 'reviewOfProcess', 'listOfPossibleActions', 'decision'],
  },
  {
    key: 'deployment',
    order: 6,
    label: { en: 'Deployment', 'pt-BR': 'Implantação' },
    tasks: [
      'deploymentPlan', 'monitoringAndMaintenancePlan', 'finalReport',
      'finalPresentation', 'experienceDocumentation',
    ],
  },
]);

export const PHASE_KEYS = PHASES.map((p) => p.key);
export const PHASE_STATUS = ['not_started', 'in_progress', 'completed'];
export const EVALUATION_DECISIONS = ['deploy', 'iterate', 'new_project', 'stop'];

export const OBJECTIVE_TYPES = ['business', 'data_mining'];
export const FIELD_DATA_TYPES = ['numeric', 'categorical', 'text', 'datetime', 'boolean', 'other'];
export const FIELD_ROLES = ['feature', 'target', 'id', 'ignore'];
export const PREP_OPERATIONS = ['select', 'clean', 'construct', 'integrate', 'format'];
export const MODEL_TECHNIQUES = [
  'classification', 'regression', 'clustering', 'association',
  'time_series', 'anomaly_detection', 'nlp', 'computer_vision', 'other',
];
export const MODEL_STATUS = ['candidate', 'approved', 'rejected', 'deployed'];
export const METRIC_SPLITS = ['train', 'validation', 'test', 'cross_validation'];
