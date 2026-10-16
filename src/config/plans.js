// Planos do KonekTron (seção 1.2 da especificação, atualizada com CRISP-DM e Kanban)
export const PLANS = Object.freeze({ FREE: 'free', STANDARD: 'standard', MASTER: 'master' });
// Planos vendidos por assinatura mensal (o Free não tem cobrança); a ordem vai do menor ao maior
export const PAID_PLANS = Object.freeze([PLANS.STANDARD, PLANS.MASTER]);
export const ROLES =Object.freeze({ CLIENT: 'client', ADMIN: 'admin', PROVIDER: 'provider' });

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

// Kanban faz parte de todos os planos
export const PLAN_SECTIONS = Object.freeze({
  [PLANS.FREE]: [SECTIONS.SYSTEM_ANALYSIS, SECTIONS.KANBAN],
  [PLANS.STANDARD]: [SECTIONS.SYSTEM_ANALYSIS, SECTIONS.BPM, SECTIONS.CRISP_DM, SECTIONS.SCRUM, SECTIONS.KANBAN],
  [PLANS.MASTER]: Object.values(SECTIONS),
});

export function canAccessSection(user, section) {
  if (user?.role === ROLES.ADMIN) return true;
  return (PLAN_SECTIONS[user?.plan] ?? []).includes(section);
}
