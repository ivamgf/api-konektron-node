import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTIONS } from '#config/plans.js';
import { eventSchema, itemSchema, memberSchema, sprintSchema, taskSchema } from '#modules/scrum/scrum.schemas.js';
import { scrumService } from '#modules/scrum/scrum.service.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const id = '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e';

test('Scrum: implementado, planos Standard e Master', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.SCRUM));
  assert.ok(canAccessSection({ role: 'client', plan: 'standard' }, SECTIONS.SCRUM));
  assert.ok(!canAccessSection({ role: 'client', plan: 'free' }, SECTIONS.SCRUM));
});

test('papéis do Scrum', () => {
  for (const role of ['product_owner', 'scrum_master', 'developer', 'stakeholder']) {
    assert.equal(memberSchema.safeParse({ name: 'Ana', role }).success, true, role);
  }
  assert.equal(memberSchema.safeParse({ name: 'Ana', role: 'gerente' }).success, false);
});

test('item do backlog: código normalizado e pontos na escala Fibonacci', () => {
  const ok = itemSchema.parse({ code: 'pb-1', title: 'Agendar', type: 'story', storyPoints: 8 });
  assert.equal(ok.code, 'PB-1');
  assert.equal(itemSchema.safeParse({ code: 'PB-1', title: 'x', type: 'story', storyPoints: 7 }).success, false);
  assert.equal(itemSchema.safeParse({ code: 'PB-1', title: 'x', type: 'epico' }).success, false);
});

test('sprint, task e eventos', () => {
  assert.equal(sprintSchema.safeParse({ number: 1, startDate: '2026-11-02', endDate: '2026-11-13' }).success, true);
  assert.equal(sprintSchema.safeParse({ number: 0 }).success, false);
  assert.equal(taskSchema.safeParse({ title: 'Tela' }).success, false); // a task pertence a uma sprint
  assert.equal(taskSchema.safeParse({ sprintId: id, title: 'Tela', estimateHours: 4 }).success, true);
  assert.equal(eventSchema.safeParse({
    type: 'daily', date: '2026-11-03', updates: [{ memberId: id, yesterday: 'API', today: 'Tela', impediments: '' }],
  }).success, true);
  assert.equal(eventSchema.safeParse({ type: 'happy_hour', date: '2026-11-03' }).success, false);
  assert.equal(eventSchema.safeParse({ type: 'review' }).success, false); // data obrigatória
});

test('burndown: ideal linear e pontos restantes pela data de conclusão', () => {
  const sprint = { startDate: '2026-09-01', endDate: '2026-09-05' }; // no passado: todos os dias têm valor real
  const items = [
    { storyPoints: 5, doneAt: '2026-09-02T15:00:00Z' },
    { storyPoints: 3, doneAt: null },
    { storyPoints: 2, doneAt: '2026-09-04T10:00:00Z' },
  ];
  const b = scrumService.burndown(sprint, items);
  assert.equal(b.total, 10);
  assert.deepEqual(b.points.map((p) => p.ideal), [10, 7.5, 5, 2.5, 0]);
  assert.deepEqual(b.points.map((p) => p.remaining), [10, 5, 5, 3, 3]);
  // dias futuros ainda não têm valor real
  const future = scrumService.burndown({ startDate: '2999-01-01', endDate: '2999-01-03' }, items);
  assert.deepEqual(future.points.map((p) => p.remaining), [null, null, null]);
  assert.equal(scrumService.burndown({ startDate: null, endDate: null }, items), null);
});

test('OpenAPI documenta o Scrum', () => {
  const { paths } = buildOpenApi();
  const base = '/projects/{projectId}/scrum';
  for (const p of ['', '/settings', '/members', '/items', '/items/{id}/move', '/sprints', '/sprints/{id}/detail', '/tasks', '/events']) {
    assert.ok(paths[`${base}${p}`], p || '/');
  }
});
