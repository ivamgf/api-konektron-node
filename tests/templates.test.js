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

// Quantidades de cada modelo, conforme os documentos de origem (RF, RNF, RD, UC e diagramas)
const EXPECTED = {
  'ers-auth-profile': { rf: 20, rnf: 19, rd: 11, uc: 10, diagrams: 14 },
  'ers-mobile-offline-online': { rf: 29, rnf: 23, rd: 17, uc: 14, diagrams: 19 },
  'ers-desktop-offline-online': { rf: 29, rnf: 23, rd: 17, uc: 14, diagrams: 19 },
  'ers-desktop-local-offline': { rf: 23, rnf: 21, rd: 13, uc: 14, diagrams: 17 },
};

test('modelos: web, mobile, desktop online e desktop offline, nessa ordem', () => {
  assert.deepEqual(TEMPLATE_KEYS, Object.keys(EXPECTED));
  const names = TEMPLATE_KEYS.map((k) => TEMPLATES[k].name);
  assert.equal(new Set(names).size, names.length);
  for (const k of TEMPLATE_KEYS) assert.ok(TEMPLATES[k].description.length > 50, k);
});

test('modelos: chave válida na rota e resumo com as contagens', () => {
  for (const key of TEMPLATE_KEYS) {
    assert.equal(templateParams.safeParse({ templateKey: key }).success, true, key);
    const e = EXPECTED[key];
    assert.deepEqual(templateSummary(TEMPLATES[key]).counts, {
      requirements: e.rf + e.rnf + e.rd, userStories: e.uc, diagrams: e.diagrams,
    }, key);
  }
  assert.equal(templateParams.safeParse({ templateKey: 'nao-existe' }).success, false);
});

test('modelos: todo o conteúdo passa nos schemas de validação sem mudar', () => {
  for (const tpl of Object.values(TEMPLATES)) {
    assert.deepEqual(analysisUpdateSchema.parse(tpl.analysis), tpl.analysis);
    for (const r of tpl.requirements) assert.deepEqual(requirementSchema.parse(r), r, `${tpl.key} ${r.code}`);
    for (const { requirementCode, ...s } of tpl.userStories) {
      assert.ok(requirementCode, s.code);
      assert.deepEqual(userStorySchema.parse(s), s, `${tpl.key} ${s.code}`);
    }
    for (const d of tpl.diagrams) assert.deepEqual(diagramSchema.parse(d), d, `${tpl.key} ${d.title}`);
  }
});

test('modelos: códigos sequenciais e únicos; casos de uso ligados a requisitos do próprio modelo', () => {
  const seq = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
  for (const tpl of Object.values(TEMPLATES)) {
    const e = EXPECTED[tpl.key];
    const codes = tpl.requirements.map((r) => r.code);
    assert.equal(new Set(codes).size, codes.length, tpl.key);
    const PREFIX = { functional: /^RF\d{2}$/, non_functional: /^RNF\d{2}$/, domain: /^RD\d{2}$/ };
    for (const r of tpl.requirements) assert.match(r.code, PREFIX[r.type], `${tpl.key} ${r.code}`);
    assert.deepEqual(codes.filter((c) => /^RF\d/.test(c)), seq('RF', e.rf), tpl.key);
    assert.deepEqual(codes.filter((c) => c.startsWith('RNF')), seq('RNF', e.rnf), tpl.key);
    assert.deepEqual(codes.filter((c) => c.startsWith('RD')), seq('RD', e.rd), tpl.key);

    assert.deepEqual(tpl.userStories.map((s) => s.code), seq('UC', e.uc), tpl.key);
    for (const s of tpl.userStories) assert.ok(codes.includes(s.requirementCode), `${tpl.key} ${s.code} → ${s.requirementCode}`);

    const titles = tpl.diagrams.map((d) => d.title);
    assert.equal(new Set(titles).size, titles.length, tpl.key);
    const types = new Set(tpl.diagrams.map((d) => d.type));
    for (const t of ['use_case', 'class', 'er', 'activity', 'sequence', 'component']) assert.ok(types.has(t), `${tpl.key} ${t}`);
  }
});

test('modelos mobile e desktop: diagrama de implantação e descrição técnica da plataforma', () => {
  for (const key of ['ers-mobile-offline-online', 'ers-desktop-offline-online', 'ers-desktop-local-offline']) {
    assert.ok(TEMPLATES[key].diagrams.some((d) => d.type === 'deployment'), key);
  }
  const mobile = TEMPLATES['ers-mobile-offline-online'];
  const desktop = TEMPLATES['ers-desktop-offline-online'];
  assert.match(mobile.analysis.technicalDescription, /Android Keystore e iOS Keychain/);
  assert.match(mobile.analysis.technicalDescription, /WorkManager/);
  assert.match(desktop.analysis.technicalDescription, /Windows Credential Manager/);
  assert.doesNotMatch(desktop.analysis.technicalDescription, /Android|iOS Keychain/);
  assert.doesNotMatch(mobile.analysis.technicalDescription, /Windows|macOS/);
  // RF10 cita o tipo de dispositivo de cada plataforma
  const rf10 = (t) => t.requirements.find((r) => r.code === 'RF10').description;
  assert.match(rf10(mobile), /dispositivo móvel/);
  assert.match(rf10(desktop), /computador/);
  // o offline local não depende de rede nem de e-mail
  const local = TEMPLATES['ers-desktop-local-offline'];
  assert.match(local.analysis.scope, /Qualquer comunicação com servidor, e-mail ou serviços na internet/);
  assert.ok(local.requirements.some((r) => r.title === 'Restaurar backup'));
});

test('modelos: diagramas com código-fonte na notação declarada', () => {
  for (const tpl of Object.values(TEMPLATES)) {
    for (const d of tpl.diagrams) {
      const id = `${tpl.key} ${d.title}`;
      assert.ok(d.source?.trim(), id);
      if (d.notation === 'plantuml') {
        assert.match(d.source, /^@startuml\n/, id);
        assert.match(d.source, /\n@enduml$/, id);
      } else {
        assert.equal(d.notation, 'mermaid', id);
        assert.match(d.source.split('\n')[0], /^(classDiagram|erDiagram|flowchart TD|sequenceDiagram)$/, id);
      }
    }
  }
});

test('modelos: o nome do projeto entra no lugar de {projeto}', () => {
  for (const tpl of Object.values(TEMPLATES)) {
    assert.ok(tpl.analysis.goal.includes('{projeto}'), tpl.key);
    assert.ok(tpl.analysis.notes.includes('{projeto}'), tpl.key);
  }
});
