// Planos do KonekTron (seção 1.2 da especificação, atualizada com CRISP-DM)
export const PLANS = Object.freeze({ FREE: 'free', STANDARD: 'standard', MASTER: 'master' });
export const ROLES = Object.freeze({ CLIENT: 'client', ADMIN: 'admin', PROVIDER: 'provider' });

export const SECTIONS = Object.freeze({
  SYSTEM_ANALYSIS: 'system-analysis',
  SYSTEM_VIEW: 'system-view',
  ONTOLOGIES: 'ontologies',
  BPM: 'bpm',
  FUNCTION_POINT: 'function-point',
  COMMONKADS: 'commonkads',
  CRISP_DM: 'crisp-dm',
});

// Seções já implementadas na API (as demais respondem 501)
export const IMPLEMENTED_SECTIONS = Object.freeze([SECTIONS.SYSTEM_ANALYSIS, SECTIONS.CRISP_DM]);

// Tipo de projeto exigido por cada seção implementada
export const SECTION_PROJECT_TYPE = Object.freeze({
  [SECTIONS.SYSTEM_ANALYSIS]: 'software',
  [SECTIONS.CRISP_DM]: 'data_analysis',
});

export const PLAN_SECTIONS = Object.freeze({
  [PLANS.FREE]: [SECTIONS.SYSTEM_ANALYSIS],
  [PLANS.STANDARD]: [SECTIONS.SYSTEM_ANALYSIS, SECTIONS.SYSTEM_VIEW, SECTIONS.BPM, SECTIONS.CRISP_DM],
  [PLANS.MASTER]: Object.values(SECTIONS),
});

export function canAccessSection(user, section) {
  if (user?.role === ROLES.ADMIN) return true;
  return (PLAN_SECTIONS[user?.plan] ?? []).includes(section);
}
