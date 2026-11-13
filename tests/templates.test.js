import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisUpdateSchema,
  diagramSchema,
  requirementSchema,
  templateParams,
  userStorySchema,
} from '#modules/system-analysis/systemAnalysis.schemas.js';
import { TEMPLATES, TEMPLATE_KEYS, templateSummary } from '#modules/system-analysis/templates/index.js';

const ers = TEMPLATES['ers-auth-profile'];

test('modelos: chave válida na rota e resumo com as contagens', () => {
  assert.ok(TEMPLATE_KEYS.includes('ers-auth-profile'));
  assert.equal(templateParams.safeParse({ templateKey: 'ers-auth-profile' }).success, true);
  assert.equal(templateParams.safeParse({ templateKey: 'nao-existe' }).success, false);
  assert.deepEqual(templateSummary(ers).counts, { requirements: 50, userStories: 10, diagrams: 14 });
});

test('ERS: todo o conteúdo passa nos schemas de validação sem mudar', () => {
  for (const tpl of Object.values(TEMPLATES)) {
    assert.deepEqual(analysisUpdateSchema.parse(tpl.analysis), tpl.analysis);
    for (const r of tpl.requirements) assert.deepEqual(requirementSchema.parse(r), r, r.code);
    for (const { requirementCode, ...s } of tpl.userStories) {
      assert.ok(requirementCode, s.code);
      assert.deepEqual(userStorySchema.parse(s), s, s.code);
    }
    for (const d of tpl.diagrams) assert.deepEqual(diagramSchema.parse(d), d, d.title);
  }
});

test('ERS: códigos e títulos únicos; casos de uso ligados a requisitos do próprio modelo', () => {
  const codes = ers.requirements.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length);
  const PREFIX = { functional: /^RF\d{2}$/, non_functional: /^RNF\d{2}$/, domain: /^RD\d{2}$/ };
  for (const r of ers.requirements) assert.match(r.code, PREFIX[r.type], r.code);
  assert.equal(codes.filter((c) => c.startsWith('RF')).length, 20);
  assert.equal(codes.filter((c) => c.startsWith('RNF')).length, 19);
  assert.equal(codes.filter((c) => c.startsWith('RD')).length, 11);

  const stories = ers.userStories.map((s) => s.code);
  assert.deepEqual(stories, Array.from({ length: 10 }, (_, i) => `UC${String(i + 1).padStart(2, '0')}`));
  for (const s of ers.userStories) assert.ok(codes.includes(s.requirementCode), `${s.code} → ${s.requirementCode}`);

  const titles = ers.diagrams.map((d) => d.title);
  assert.equal(new Set(titles).size, titles.length);
  const types = new Set(ers.diagrams.map((d) => d.type));
  for (const t of ['use_case', 'class', 'er', 'activity', 'sequence', 'component']) assert.ok(types.has(t), t);
});

test('ERS: diagramas com código-fonte na notação declarada', () => {
  for (const d of ers.diagrams) {
    assert.ok(d.source?.trim(), d.title);
    if (d.notation === 'plantuml') {
      assert.match(d.source, /^@startuml\n/, d.title);
      assert.match(d.source, /\n@enduml$/, d.title);
    } else {
      assert.equal(d.notation, 'mermaid', d.title);
      assert.match(d.source.split('\n')[0], /^(classDiagram|erDiagram|flowchart TD|sequenceDiagram)$/, d.title);
    }
  }
});

test('ERS: o nome do projeto entra no lugar de {projeto}', () => {
  assert.ok(ers.analysis.goal.includes('{projeto}'));
  assert.ok(ers.analysis.notes.includes('{projeto}'));
});
