// Perfis do KonekTron. Os planos continuam distintos no cadastro, mas todos dão acesso a todas as seções;
// quem muda o plano de um usuário é o administrador, no painel (todo cadastro novo começa Free).
export const PLANS = Object.freeze({ FREE: 'free', STANDARD: 'standard', MASTER: 'master' });
export const ROLES = Object.freeze({ CLIENT: 'client', ADMIN: 'admin', PROVIDER: 'provider' });

export const SECTIONS = Object.freeze({
  SYSTEM_ANALYSIS: 'system-analysis',
  ONTOLOGIES: 'ontologies',
  BPM: 'bpm',
  FUNCTION_POINT: 'function-point',
  COMMONKADS: 'commonkads',
  CRISP_DM: 'crisp-dm',
  SCRUM: 'scrum',
  KANBAN: 'kanban',
});

// Seções já implementadas na API (as demais respondem 501)
export const IMPLEMENTED_SECTIONS = Object.freeze([
  SECTIONS.SYSTEM_ANALYSIS, SECTIONS.ONTOLOGIES, SECTIONS.BPM, SECTIONS.FUNCTION_POINT, SECTIONS.COMMONKADS,
  SECTIONS.CRISP_DM, SECTIONS.SCRUM, SECTIONS.KANBAN,
]);

// Tipo de projeto exigido por seção; as ausentes (Ontologias, BPM, CommonKADS, Scrum, Kanban) servem a qualquer tipo
export const SECTION_PROJECT_TYPE = Object.freeze({
  [SECTIONS.SYSTEM_ANALYSIS]: 'software',
  [SECTIONS.FUNCTION_POINT]: 'software',
  [SECTIONS.CRISP_DM]: 'data_analysis',
});

// Todos os planos (inclusive o Free) acessam todas as seções
export function canAccessSection(user, section) {
  return Boolean(user) && Object.values(SECTIONS).includes(section);
}

// Administração (usuários, mensagens, logs, projetos de terceiros): só administrador com plano Master
export const isMasterAdmin = (user) => user?.role === ROLES.ADMIN && user?.plan === PLANS.MASTER;
