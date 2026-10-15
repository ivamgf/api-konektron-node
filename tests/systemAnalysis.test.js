import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diagramSchema,
  requirementFilters,
  requirementSchema,
  userStorySchema,
} from '#modules/system-analysis/systemAnalysis.schemas.js';
import { changePasswordSchema } from '#modules/auth/auth.schemas.js';
import { IMPLEMENTED_SECTIONS, SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';

test('requisito: código é normalizado e validado', () => {
  const ok = requirementSchema.parse({ code: ' rnf7 ', title: 'Tempo de resposta', type: 'non_functional' });
  assert.equal(ok.code, 'RNF7');
  assert.equal(requirementSchema.safeParse({ code: 'RF 1', title: 'x', type: 'functional' }).success, false);
  assert.equal(requirementSchema.safeParse({ code: 'RF1', title: 'x', type: 'magia' }).success, false);
});

test('história de usuário: "como" e "quero" obrigatórios, pontos na escala Fibonacci', () => {
  const base = { code: 'US1', title: 'Agendar', asA: 'cliente', iWant: 'agendar' };
  assert.equal(userStorySchema.safeParse(base).success, true);
  assert.equal(userStorySchema.safeParse({ ...base, storyPoints: 8 }).success, true);
  assert.equal(userStorySchema.safeParse({ ...base, storyPoints: 7 }).success, false);
  assert.equal(userStorySchema.safeParse({ ...base, iWant: '' }).success, false);
});

test('diagrama: tipo e URL validados', () => {
  assert.equal(diagramSchema.safeParse({ title: 'Classes', type: 'class' }).success, true);
  assert.equal(diagramSchema.safeParse({ title: 'Classes', type: 'class', url: 'nao-e-url' }).success, false);
});

test('filtros descartam parâmetros desconhecidos (não viram WHERE)', () => {
  assert.deepEqual(requirementFilters.parse({ type: 'functional', projectId: 'x' }), { type: 'functional' });
});

test('troca de senha: confirmação e senha nova diferente da atual', () => {
  const base = { currentPassword: 'antiga123', password: 'nova12345', confirmPassword: 'nova12345' };
  assert.equal(changePasswordSchema.safeParse(base).success, true);
  assert.equal(changePasswordSchema.safeParse({ ...base, confirmPassword: 'outra123' }).success, false);
  assert.equal(
    changePasswordSchema.safeParse({ ...base, password: 'antiga123', confirmPassword: 'antiga123' }).success,
    false,
  );
});

test('seções implementadas: as de metodologia exigem um tipo de projeto, as demais servem a qualquer tipo', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.SYSTEM_ANALYSIS));
  const anyType = [SECTIONS.ONTOLOGIES, SECTIONS.BPM, SECTIONS.COMMONKADS, SECTIONS.SCRUM, SECTIONS.KANBAN];
  for (const s of IMPLEMENTED_SECTIONS) {
    if (anyType.includes(s)) assert.equal(SECTION_PROJECT_TYPE[s], undefined, s);
    else assert.ok(SECTION_PROJECT_TYPE[s], s);
  }
  assert.equal(SECTIONS.SYSTEM_VIEW, undefined); // Visão de Sistema removida (a Análise de Sistemas cobre)
});
