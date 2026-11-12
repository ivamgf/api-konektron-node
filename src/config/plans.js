// Planos do KonekTron. Free é gratuito (até 3 projetos criados na vida da conta; projetos sem uso por
// 3 meses são excluídos). Standard e Master são assinaturas mensais pelo Asaas. Todos os planos têm a
// integração com IA nas seções que incluem.
export const PLANS = Object.freeze({ FREE: 'free', STANDARD: 'standard', MASTER: 'master' });
// Planos vendidos por assinatura mensal; a ordem vai do menor ao maior
export const PAID_PLANS = Object.freeze([PLANS.STANDARD, PLANS.MASTER]);
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
  DATA_DIAGNOSIS: 'data-diagnosis',
});

// Seções já implementadas na API (as demais respondem 501)
export const IMPLEMENTED_SECTIONS = Object.freeze([
  SECTIONS.SYSTEM_ANALYSIS, SECTIONS.ONTOLOGIES, SECTIONS.BPM, SECTIONS.FUNCTION_POINT, SECTIONS.COMMONKADS,
  SECTIONS.CRISP_DM, SECTIONS.SCRUM, SECTIONS.KANBAN, SECTIONS.DATA_DIAGNOSIS,
]);

// Tipo de projeto exigido por seção; as ausentes (Ontologias, BPM, CommonKADS, Scrum, Kanban) servem a qualquer tipo
export const SECTION_PROJECT_TYPE = Object.freeze({
  [SECTIONS.SYSTEM_ANALYSIS]: 'software',
  [SECTIONS.FUNCTION_POINT]: 'software',
  [SECTIONS.CRISP_DM]: 'data_analysis',
});

// CRISP-DM (análise de projetos de dados) é exclusivo do Master
export const PLAN_SECTIONS = Object.freeze({
  [PLANS.FREE]: Object.freeze([SECTIONS.SYSTEM_ANALYSIS, SECTIONS.SCRUM, SECTIONS.KANBAN]),
  [PLANS.STANDARD]: Object.freeze([SECTIONS.SYSTEM_ANALYSIS, SECTIONS.BPM, SECTIONS.SCRUM, SECTIONS.KANBAN, SECTIONS.FUNCTION_POINT]),
  [PLANS.MASTER]: Object.freeze(Object.values(SECTIONS)),
});

// Mensalidade em centavos (R$ 49,90 e R$ 79,90)
export const PLAN_PRICES = Object.freeze({ [PLANS.STANDARD]: 4990, [PLANS.MASTER]: 7990 });

// Free: projetos que a conta pode criar (excluir não devolve a vaga) e meses sem uso até a exclusão
export const FREE_PROJECT_LIMIT = 3;
export const FREE_INACTIVE_MONTHS = 3;

export const planRank = (plan) => [PLANS.FREE, ...PAID_PLANS].indexOf(plan);
export const higherPlan = (a, b) => (planRank(a) >= planRank(b) ? a : b);

// Administrador com plano Master vê tudo; os demais, as seções do próprio plano
export function sectionsOf(user) {
  if (!user) return [];
  if (isMasterAdmin(user)) return [...PLAN_SECTIONS[PLANS.MASTER]];
  return [...(PLAN_SECTIONS[user.plan] ?? [])];
}

export function canAccessSection(user, section) {
  return sectionsOf(user).includes(section);
}

// Planos (do menor ao maior) que incluem a seção
export const plansWithSection = (section) =>
  [PLANS.FREE, ...PAID_PLANS].filter((plan) => PLAN_SECTIONS[plan].includes(section));

// Limite de projetos do plano (null = sem limite)
export const projectLimitOf = (user) =>
  user?.plan === PLANS.FREE && !isMasterAdmin(user) ? FREE_PROJECT_LIMIT : null;

// Administração (usuários, mensagens, logs, projetos de terceiros): só administrador com plano Master
export const isMasterAdmin = (user) => user?.role === ROLES.ADMIN && user?.plan === PLANS.MASTER;
