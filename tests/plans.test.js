import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessSection, FREE_PROJECT_LIMIT, isMasterAdmin, PLAN_PRICES, PLAN_SECTIONS, PLANS, plansWithSection, projectLimitOf, ROLES,
  SECTIONS,
} from '#config/plans.js';
import { PROJECT_ACCESS } from '#middlewares/loadProject.js';
import { projectSections, purgeDate, quotaOf } from '#modules/projects/projects.service.js';
import { addMemberSchema, listQuery } from '#modules/projects/projects.schemas.js';

const client = (plan) => ({ role: ROLES.CLIENT, plan });

test('Free: análise (sistemas ou dados), Scrum e Kanban', () => {
  assert.deepEqual(
    [...PLAN_SECTIONS.free].sort(),
    [SECTIONS.SYSTEM_ANALYSIS, SECTIONS.CRISP_DM, SECTIONS.SCRUM, SECTIONS.KANBAN].sort(),
  );
  for (const s of [SECTIONS.BPM, SECTIONS.FUNCTION_POINT, SECTIONS.ONTOLOGIES, SECTIONS.COMMONKADS, SECTIONS.DATA_DIAGNOSIS]) {
    assert.ok(!canAccessSection(client(PLANS.FREE), s), s);
  }
});

test('Standard: análise, BPM, Scrum, Kanban e Pontos de Função', () => {
  assert.deepEqual(
    [...PLAN_SECTIONS.standard].sort(),
    [SECTIONS.SYSTEM_ANALYSIS, SECTIONS.CRISP_DM, SECTIONS.BPM, SECTIONS.SCRUM, SECTIONS.KANBAN, SECTIONS.FUNCTION_POINT].sort(),
  );
  assert.ok(!canAccessSection(client(PLANS.STANDARD), SECTIONS.ONTOLOGIES));
});

test('Master: acesso total', () => {
  for (const s of Object.values(SECTIONS)) assert.ok(canAccessSection(client(PLANS.MASTER), s), s);
});

test('preços: Standard R$ 79,90 e Master R$ 179,00 (centavos)', () => {
  assert.equal(PLAN_PRICES.standard, 7990);
  assert.equal(PLAN_PRICES.master, 17900);
});

test('planos que incluem cada seção', () => {
  assert.deepEqual(plansWithSection(SECTIONS.KANBAN), ['free', 'standard', 'master']);
  assert.deepEqual(plansWithSection(SECTIONS.BPM), ['standard', 'master']);
  assert.deepEqual(plansWithSection(SECTIONS.ONTOLOGIES), ['master']);
});

test('seção desconhecida ou sem usuário não é liberada', () => {
  assert.ok(!canAccessSection(client(PLANS.MASTER), 'inexistente'));
  assert.ok(!canAccessSection(null, SECTIONS.KANBAN));
});

test('administração só para administrador com plano master', () => {
  assert.ok(isMasterAdmin({ role: ROLES.ADMIN, plan: PLANS.MASTER }));
  assert.ok(!isMasterAdmin({ role: ROLES.ADMIN, plan: PLANS.FREE }));
  assert.ok(!isMasterAdmin({ role: ROLES.ADMIN, plan: PLANS.STANDARD }));
  assert.ok(!isMasterAdmin({ role: ROLES.CLIENT, plan: PLANS.MASTER }));
  assert.ok(!isMasterAdmin({ role: ROLES.PROVIDER, plan: PLANS.MASTER }));
  assert.ok(!isMasterAdmin(undefined));
});

test('Free cria até 3 projetos na vida da conta; pagos sem limite', () => {
  assert.equal(FREE_PROJECT_LIMIT, 3);
  assert.equal(projectLimitOf(client(PLANS.FREE)), 3);
  assert.equal(projectLimitOf(client(PLANS.STANDARD)), null);
  assert.deepEqual(quotaOf({ ...client('free'), projectsCreated: 2 }), { plan: 'free', limit: 3, used: 2, canCreate: true });
  // excluir não devolve a vaga: o contador só cresce
  assert.equal(quotaOf({ ...client('free'), projectsCreated: 3 }).canCreate, false);
  assert.equal(quotaOf({ ...client('master'), projectsCreated: 40 }).canCreate, true);
});

test('Free: projeto sem uso é excluído 3 meses depois do último acesso', () => {
  assert.equal(purgeDate('2026-01-15T10:00:00Z').toISOString().slice(0, 10), '2026-04-15');
});

test('seções num projeto compartilhado: interseção dos planos; acesso Kanban só vê o Kanban', () => {
  const free = client('free');
  const master = client('master');
  const standard = client('standard');
  // dono Master compartilha com um Free: o Free não entra nas seções de planos superiores
  assert.deepEqual(projectSections(PROJECT_ACCESS.PROJECT, free, master).sort(), [...PLAN_SECTIONS.free].sort());
  // dono Free compartilha com um Master: as seções do Master não valem no projeto do Free
  assert.deepEqual(projectSections(PROJECT_ACCESS.PROJECT, master, free).sort(), [...PLAN_SECTIONS.free].sort());
  assert.ok(!projectSections(PROJECT_ACCESS.PROJECT, standard, master).includes(SECTIONS.ONTOLOGIES));
  assert.deepEqual(projectSections(PROJECT_ACCESS.KANBAN, master, master), [SECTIONS.KANBAN]);
  assert.deepEqual(projectSections(PROJECT_ACCESS.OWNER, master, master).length, Object.values(SECTIONS).length);
});

test('convite: e-mail normalizado, acesso project (padrão) ou kanban', () => {
  assert.deepEqual(addMemberSchema.parse({ email: 'Ana@Exemplo.com' }), { email: 'ana@exemplo.com', access: 'project' });
  assert.equal(addMemberSchema.safeParse({ email: 'x@y.com', access: 'admin' }).success, false);
  assert.equal(addMemberSchema.safeParse({ email: 'nao-e-email' }).success, false);
  assert.equal(listQuery.parse({ scope: 'shared' }).scope, 'shared');
});
