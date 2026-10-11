// Análise de Sistemas — artefatos de engenharia de requisitos de um projeto `software`
export const REQUIREMENT_TYPES = ['functional', 'non_functional', 'business_rule'];
export const REQUIREMENT_STATUS = ['proposed', 'approved', 'implemented', 'rejected'];
export const PRIORITIES = ['must', 'should', 'could', 'wont']; // MoSCoW

export const USER_STORY_STATUS = ['backlog', 'ready', 'in_progress', 'done'];
export const STORY_POINTS = [0, 1, 2, 3, 5, 8, 13, 21, 40, 100]; // escala Fibonacci (planning poker)

export const DIAGRAM_TYPES = [
  'use_case', 'class', 'sequence', 'activity', 'state', 'component',
  'deployment', 'er', 'bpmn', 'flowchart', 'other',
];
export const DIAGRAM_NOTATIONS = ['mermaid', 'plantuml', 'drawio', 'bpmn_xml', 'image', 'other'];
