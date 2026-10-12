import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, PLAN_SECTIONS, SECTIONS } from '#config/plans.js';
import {
  cardSchema,
  cardUpdateSchema,
  columnSchema,
  moveCardSchema,
} from '#modules/kanban/kanban.schemas.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const columnId = '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e';

test('Kanban está implementado e em todos os planos', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.KANBAN));
  for (const plan of Object.keys(PLAN_SECTIONS)) {
    assert.ok(canAccessSection({ role: 'client', plan }, SECTIONS.KANBAN), plan);
  }
});

test('coluna: nome obrigatório, limite WIP inteiro positivo', () => {
  assert.equal(columnSchema.safeParse({ name: 'A fazer' }).success, true);
  assert.equal(columnSchema.safeParse({ name: '  ' }).success, false);
  assert.equal(columnSchema.safeParse({ name: 'Doing', wipLimit: 0 }).success, false);
  assert.equal(columnSchema.safeParse({ name: 'Doing', wipLimit: 2.5 }).success, false);
});

test('cartão: coluna e título obrigatórios, prioridade e prazo validados', () => {
  const base = { columnId, title: 'Tela de login' };
  assert.equal(cardSchema.safeParse(base).success, true);
  assert.equal(cardSchema.safeParse({ ...base, priority: 'urgent', dueDate: '2026-12-01' }).success, true);
  assert.equal(cardSchema.safeParse({ ...base, priority: 'critica' }).success, false);
  assert.equal(cardSchema.safeParse({ ...base, dueDate: '01/12/2026' }).success, false);
  assert.equal(cardSchema.safeParse({ title: 'sem coluna' }).success, false);
});

test('PATCH do cartão não muda coluna nem posição (só /move)', () => {
  assert.deepEqual(cardUpdateSchema.parse({ columnId, position: 3, title: 'x' }), { title: 'x' });
});

test('mover cartão exige coluna e posição não negativa', () => {
  assert.equal(moveCardSchema.safeParse({ columnId, position: 0 }).success, true);
  assert.equal(moveCardSchema.safeParse({ columnId, position: -1 }).success, false);
  assert.equal(moveCardSchema.safeParse({ position: 1 }).success, false);
});

test('OpenAPI documenta o quadro e os movimentos', () => {
  const { paths } = buildOpenApi();
  for (const p of ['', '/columns', '/columns/{id}/move', '/cards', '/cards/{id}', '/cards/{id}/move']) {
    assert.ok(paths[`/projects/{projectId}/kanban${p}`], p || '/');
  }
});
