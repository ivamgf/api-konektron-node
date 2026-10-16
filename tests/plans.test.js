import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, isMasterAdmin, PLANS, ROLES, SECTIONS } from '#config/plans.js';

test('todos os planos, inclusive o free, acessam todas as seções', () => {
  for (const plan of Object.values(PLANS)) {
    for (const s of Object.values(SECTIONS)) assert.ok(canAccessSection({ role: 'client', plan }, s));
  }
});

test('seção desconhecida ou sem usuário não é liberada', () => {
  assert.ok(!canAccessSection({ role: 'client', plan: 'free' }, 'inexistente'));
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
