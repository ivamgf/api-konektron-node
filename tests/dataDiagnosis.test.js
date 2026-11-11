import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPLEMENTED_SECTIONS, SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import {
  aiUsageSchema,
  inventorySchema,
  MATURITY_DIMENSIONS,
  planSchema,
  reportSchema,
} from '#modules/data-diagnosis/dataDiagnosis.schemas.js';
import { buildOpenApi } from '../src/docs/openapi.js';

test('diagnóstico de dados: seção implementada para qualquer tipo de projeto', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.DATA_DIAGNOSIS));
  assert.equal(SECTION_PROJECT_TYPE[SECTIONS.DATA_DIAGNOSIS], undefined);
});

test('inventário: sistemas, bases, integrações e pendências; campos vazios aceitos', () => {
  const r = inventorySchema.safeParse({
    title: 'Inventário',
    content: {
      identification: { organization: 'Prefeitura', periodStart: '2026-11-01', periodEnd: '' },
      systems: [{ code: 'S01', name: 'ERP', vendorType: 'commercial', hosting: 'vendor_cloud', users: 120, criticality: 'high', status: '' }],
      databases: [{ code: 'B01', systemCode: 'S01', personalData: 'yes', documentation: 'partial' }],
      integrations: [{ code: 'I01', origin: 'S01', destination: 'S02', method: 'api' }],
      pending: [{ itemCode: 'S02', question: 'Contrato vigente?', dueDate: '2026-11-30' }],
      nextSteps: { validateOwners: { done: true } },
    },
  });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(inventorySchema.safeParse({ title: 'x', content: { systems: [{ criticality: 'altíssima' }] } }).success, false);
});

test('relatório: maturidade de 1 a 5 por dimensão, com alvo, peso e evidência', () => {
  const maturity = Object.fromEntries(MATURITY_DIMENSIONS.map((d, i) => [d, { level: (i % 5) + 1, target: 5, weight: 1, evidence: 'Entrevista' }]));
  const ok = reportSchema.safeParse({
    title: 'Diagnóstico',
    content: {
      sources: [{ code: 'F01', type: 'relational', personalData: 'yes', criticality: 'high' }],
      flows: [{ code: 'FL01', origin: 'F01', destination: 'DW', method: 'manual', monitored: 'no' }],
      quality: [{ sourceCode: 'F01', completeness: 3, accuracy: null }],
      governance: { roles: { done: true, situation: 'DPO nomeado' } },
      personalData: [{ sourceCode: 'F01', legalBasis: 'contract', sensitive: 'no' }],
      maturity: { ...maturity, validatedAt: '2026-11-20' },
    },
  });
  assert.ok(ok.success, JSON.stringify(ok.error?.issues));
  for (const level of [0, 6, 2.5]) {
    assert.equal(reportSchema.safeParse({ title: 'x', content: { maturity: { flows: { level } } } }).success, false, String(level));
  }
});

test('plano: fases, atividades, RACI e checklist de entrada em produção', () => {
  const r = planSchema.safeParse({
    title: 'Plano',
    version: '1.0',
    content: {
      identification: { system: 'ERP', budget: 1000.5 },
      phases: { planning: { start: '2026-11-01', end: '2026-11-15', deliverable: 'Plano aprovado' } },
      activities: [{ code: '1.1', phase: 'planning', activity: 'Kickoff', status: 'not_started' }],
      raci: [{ deliverable: 'Plano', sponsor: 'A', manager: 'R', keyUsers: 'C', it: 'C', vendor: '' }],
      goLive: { rollback: { done: false } },
    },
  });
  assert.ok(r.success, JSON.stringify(r.error?.issues));
  assert.equal(planSchema.safeParse({ title: 'x', content: { raci: [{ sponsor: 'X' }] } }).success, false);
  assert.equal(planSchema.safeParse({ title: '' }).success, false);
});

test('uso de IA: só metadados, modo api ou assistant', () => {
  assert.ok(aiUsageSchema.safeParse({ feature: 'Gerar: Objetivo', mode: 'assistant' }).success);
  assert.equal(aiUsageSchema.safeParse({ feature: 'x', mode: 'outro' }).success, false);
});

test('OpenAPI documenta as rotas do diagnóstico e do uso de IA', () => {
  const { paths } = buildOpenApi();
  for (const p of ['inventories', 'reports', 'plans']) {
    assert.ok(paths[`/projects/{projectId}/data-diagnosis/${p}/{id}`]?.patch, p);
  }
  assert.ok(paths['/projects/{projectId}/ai-usage'].post);
});
