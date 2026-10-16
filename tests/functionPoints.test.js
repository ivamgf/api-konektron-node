import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { complexity, evaluate, WEIGHTS } from '#modules/function-points/fp.rules.js';
import { countSchema, functionSchema } from '#modules/function-points/fp.schemas.js';
import { fpService } from '#modules/function-points/fp.service.js';
import { buildOpenApi } from '../src/docs/openapi.js';

test('Pontos de Função: implementado, projetos software, liberado no Free', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.FUNCTION_POINT));
  assert.equal(SECTION_PROJECT_TYPE[SECTIONS.FUNCTION_POINT], 'software');
  assert.ok(canAccessSection({ role: 'client', plan: 'free' }, SECTIONS.FUNCTION_POINT));
});

test('tabela de complexidade ALI/AIE (planilha): TR × TD', () => {
  // TR \ TD     <20      20-50     >50
  // 1           Baixa    Baixa     Média
  // 2-5         Baixa    Média     Alta
  // >5          Média    Alta      Alta
  const expected = [
    [1, 19, 'low'], [1, 20, 'low'], [1, 50, 'low'], [1, 51, 'average'],
    [2, 19, 'low'], [5, 20, 'average'], [5, 50, 'average'], [3, 51, 'high'],
    [6, 19, 'average'], [6, 20, 'high'], [9, 80, 'high'],
  ];
  for (const [ret, det, cx] of expected) {
    assert.equal(complexity('ilf', det, ret), cx, `ILF TR=${ret} TD=${det}`);
    assert.equal(complexity('eif', det, ret), cx, `AIE TR=${ret} TD=${det}`);
  }
});

test('tabela de contribuição (planilha): ALI 7/10/15, AIE 5/7/10', () => {
  assert.deepEqual(WEIGHTS.ilf, { low: 7, average: 10, high: 15 });
  assert.deepEqual(WEIGHTS.eif, { low: 5, average: 7, high: 10 });
  assert.deepEqual(evaluate({ type: 'ilf', det: 25, retFtr: 3 }), { complexity: 'average', points: 10 });
  assert.deepEqual(evaluate({ type: 'eif', det: 60, retFtr: 1 }), { complexity: 'average', points: 7 });
});

test('funções de transação (IFPUG): EE, SE e CE', () => {
  assert.deepEqual(evaluate({ type: 'ei', det: 4, retFtr: 1 }), { complexity: 'low', points: 3 });
  assert.deepEqual(evaluate({ type: 'ei', det: 16, retFtr: 2 }), { complexity: 'high', points: 6 });
  assert.deepEqual(evaluate({ type: 'eo', det: 6, retFtr: 2 }), { complexity: 'average', points: 5 });
  assert.deepEqual(evaluate({ type: 'eo', det: 20, retFtr: 4 }), { complexity: 'high', points: 7 });
  assert.deepEqual(evaluate({ type: 'eq', det: 5, retFtr: 3 }), { complexity: 'low', points: 3 });
});

test('resumo: escopo, TD/TR, contribuição, total e estimativa', () => {
  const fn = (type, det, retFtr, action) => ({ type, det, retFtr, action, ...evaluate({ type, det, retFtr }) });
  const functions = [fn('ilf', 12, 2, 'add'), fn('ilf', 30, 3, 'change'), fn('eif', 10, 1), fn('ei', 8, 2, 'add'), fn('eo', 3, 1)];
  const r = fpService.summarize({ countType: 'enhancement', hoursPerFp: 8, costPerHour: 100, currency: 'BRL' }, functions);
  assert.deepEqual(r.scope, { ilf: 2, eif: 1, total: 3 });
  assert.deepEqual(r.complexity, { det: 52, ret: 6, total: 58 });
  assert.equal(r.contribution.ilf.points, 7 + 10);
  assert.equal(r.dataPoints, 17 + 5);
  assert.equal(r.transactionPoints, 4 + 4);
  assert.equal(r.totalPoints, 30);
  assert.deepEqual(r.byAction, { add: 7 + 4, change: 10, delete: 0 });
  assert.deepEqual(r.estimate, { effortHours: 240, cost: 24000, currency: 'BRL' });
  assert.equal(fpService.summarize({ countType: 'development' }, functions).estimate.effortHours, null);
});

test('schemas: tipo de contagem e de função, TD/TR inteiros', () => {
  assert.equal(countSchema.safeParse({ name: 'Inicial', countType: 'development' }).success, true);
  assert.equal(countSchema.safeParse({ name: 'Inicial', countType: 'estimativa' }).success, false);
  assert.equal(functionSchema.safeParse({ name: 'Clientes', type: 'ilf', det: 12, retFtr: 2 }).success, true);
  assert.equal(functionSchema.safeParse({ name: 'Clientes', type: 'ali', det: 12, retFtr: 2 }).success, false);
  assert.equal(functionSchema.safeParse({ name: 'Clientes', type: 'ilf', det: 1.5, retFtr: 2 }).success, false);
});

test('OpenAPI documenta contagens, funções e o resumo', () => {
  const { paths } = buildOpenApi();
  const base = '/projects/{projectId}/function-points';
  for (const p of ['', '/counts', '/counts/{id}', '/counts/{id}/summary', '/counts/{countId}/functions', '/counts/{countId}/functions/{id}']) {
    assert.ok(paths[`${base}${p}`], p || '/');
  }
});
