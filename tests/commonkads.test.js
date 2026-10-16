import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTIONS } from '#config/plans.js';
import { WORKSHEET_KEYS, WORKSHEETS } from '#modules/commonkads/commonkads.constants.js';
import {
  agentSchema,
  knowledgeSchema,
  taskSchema,
  transactionSchema,
  WORKSHEET_CONTENT_SCHEMAS,
  worksheetParams,
} from '#modules/commonkads/commonkads.schemas.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const id = '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e';

test('CommonKADS: implementado e liberado no Free', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.COMMONKADS));
  assert.ok(canAccessSection({ role: 'client', plan: 'free' }, SECTIONS.COMMONKADS));
});

test('as 17 planilhas: as de texto têm campos, as em linhas apontam para um cadastro', () => {
  assert.deepEqual(WORKSHEET_KEYS, [
    'om-1', 'om-2', 'om-3', 'om-4', 'om-5', 'tm-1', 'tm-2', 'am-1', 'mas', 'ota-1', 'km-1', 'cm-1', 'cm-2', 'dm-1', 'dm-2', 'dm-3', 'dm-4',
  ]);
  for (const w of WORKSHEETS) assert.ok(Boolean(w.fields?.length) !== Boolean(w.resource), w.key);
  assert.equal(worksheetParams.safeParse({ key: 'om-9' }).success, false);
});

test('conteúdo da planilha: só os campos dela', () => {
  const om1 = WORKSHEET_CONTENT_SCHEMAS['om-1'];
  assert.deepEqual(om1.parse({ solutions: 'Sistema especialista', extra: 'x' }), { solutions: 'Sistema especialista' });
  assert.equal(om1.safeParse({ solutions: 42 }).success, false);
  assert.deepEqual(WORKSHEET_CONTENT_SCHEMAS['tm-1'].parse({ goalValue: 'x' }), {}); // planilha em linhas
});

test('tarefa (OM-3/TM-1): código, vínculos por uuid e significância de 1 a 5', () => {
  const ok = taskSchema.parse({ code: 't1', name: 'Diagnosticar', agentIds: [id], knowledgeIntensive: true, significance: 5 });
  assert.equal(ok.code, 'T1');
  assert.equal(taskSchema.safeParse({ code: 'T1', name: 'x', significance: 6 }).success, false);
  assert.equal(taskSchema.safeParse({ code: 'T1', name: 'x', agentIds: ['nao-uuid'] }).success, false);
});

test('conhecimento (OM-4/TM-2): caracterização só com os itens da planilha', () => {
  const base = { name: 'Regras de diagnóstico' };
  const characterization = {
    nature: { heuristic: { applies: true, bottleneck: true }, tacit: { applies: true, notes: 'difícil de explicar' } },
    availability: { access: { bottleneck: true } },
  };
  assert.equal(knowledgeSchema.safeParse({ ...base, rightForm: false, characterization }).success, true);
  assert.deepEqual(
    knowledgeSchema.parse({ ...base, characterization: { nature: { inventado: { applies: true } } } }).characterization,
    { nature: {} },
  );
  assert.equal(knowledgeSchema.safeParse({ ...base, characterization: { form: { mind: { applies: 'sim' } } } }).success, false);
});

test('agente (AM-1/MAS): tipo obrigatório', () => {
  assert.equal(agentSchema.safeParse({ name: 'Técnico', kind: 'human' }).success, true);
  assert.equal(agentSchema.safeParse({ name: 'Técnico' }).success, false);
  assert.equal(agentSchema.safeParse({ name: 'Robô', kind: 'robot' }).success, false);
});

test('transação (CM-1/CM-2): itens de informação e mensagens tipadas', () => {
  const base = { code: 'TR1', name: 'Informar diagnóstico' };
  assert.equal(transactionSchema.safeParse({
    ...base,
    informationItems: [{ name: 'Diagnóstico', role: 'core', form: 'texto', medium: 'janela' }],
    messages: [{ type: 'report', content: 'Diagnóstico concluído' }],
  }).success, true);
  assert.equal(transactionSchema.safeParse({ ...base, messages: [{ type: 'shout', content: 'x' }] }).success, false);
  assert.equal(transactionSchema.safeParse({ ...base, informationItems: [{ name: 'x', role: 'main' }] }).success, false);
});

test('OpenAPI documenta planilhas e cadastros', () => {
  const { paths } = buildOpenApi();
  const base = '/projects/{projectId}/commonkads';
  for (const p of ['', '/report', '/worksheets', '/worksheets/{key}', '/tasks', '/knowledge/{id}', '/agents', '/transactions/{id}']) {
    assert.ok(paths[`${base}${p}`], p || '/');
  }
  const key = paths[`${base}/worksheets/{key}`].patch.parameters.find((p) => p.name === 'key');
  assert.deepEqual(key.schema.enum, WORKSHEET_KEYS);
});
