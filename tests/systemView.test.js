import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessSection, IMPLEMENTED_SECTIONS, SECTION_PROJECT_TYPE, SECTIONS } from '#config/plans.js';
import { buildFeatures, draftScenarios, lines, scenarioToGherkin, keywordsFor } from '#modules/system-view/gherkin.js';
import { flowSchema, relationSchema, scenarioSchema, useCaseSchema } from '#modules/system-view/systemView.schemas.js';
import { requirementSchema } from '#modules/system-analysis/systemAnalysis.schemas.js';
import { buildOpenApi } from '../src/docs/openapi.js';

const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;

test('Visão de Sistema: implementada, projetos software, planos Standard e Master', () => {
  assert.ok(IMPLEMENTED_SECTIONS.includes(SECTIONS.SYSTEM_VIEW));
  assert.equal(SECTION_PROJECT_TYPE[SECTIONS.SYSTEM_VIEW], 'software');
  assert.equal(canAccessSection({ role: 'client', plan: 'free' }, SECTIONS.SYSTEM_VIEW), false);
  assert.ok(canAccessSection({ role: 'client', plan: 'standard' }, SECTIONS.SYSTEM_VIEW));
  assert.ok(canAccessSection({ role: 'client', plan: 'master' }, SECTIONS.SYSTEM_VIEW));
});

test('requisito de domínio (RD) é aceito na Análise de Sistemas', () => {
  assert.equal(requirementSchema.safeParse({ code: 'RD1', title: 'Glossário bancário', type: 'domain' }).success, true);
});

test('caso de uso: código normalizado, ator obrigatório, requisitos como UUIDs', () => {
  const uc = useCaseSchema.parse({ code: 'uc001', name: 'Abrir conta', primaryActor: 'Funcionário', requirementIds: [id(1)] });
  assert.equal(uc.code, 'UC001');
  assert.equal(useCaseSchema.safeParse({ code: 'UC1', name: 'X' }).success, false);
  assert.equal(useCaseSchema.safeParse({ code: 'UC1', name: 'X', primaryActor: 'A', requirementIds: ['rf1'] }).success, false);
});

test('cenário do caso de uso: cada passo precisa de ação do ator ou do sistema', () => {
  assert.equal(flowSchema.safeParse({ kind: 'main', title: 'Principal', steps: [{ actor: 'Informa o CPF' }, { system: 'Consulta' }] }).success, true);
  assert.equal(flowSchema.safeParse({ kind: 'main', title: 'Principal', steps: [{ actor: '', system: '' }] }).success, false);
  assert.equal(flowSchema.safeParse({ kind: 'erro', title: 'x', steps: [] }).success, false);
});

test('relação só aceita include/extend', () => {
  assert.equal(relationSchema.safeParse({ fromUseCaseId: id(1), toUseCaseId: id(2), type: 'extend', condition: 'senha inválida' }).success, true);
  assert.equal(relationSchema.safeParse({ fromUseCaseId: id(1), toUseCaseId: id(2), type: 'uses' }).success, false);
  assert.equal(scenarioSchema.safeParse({ title: 'x', userStoryId: 'nao-uuid' }).success, false);
});

test('passo continua a frase: minúscula depois da palavra-chave, siglas mantidas', () => {
  const g = scenarioToGherkin({ title: 't', given: 'O pedido foi aprovado', when: 'CPF informado\nÉ feriado' }, keywordsFor('pt-BR'));
  assert.match(g, /Dado o pedido foi aprovado\n {4}Quando CPF informado\n {4}E é feriado/);
});

test('linhas: remove numeração e marcadores', () => {
  assert.deepEqual(lines('1. Informa o CPF\n2) Consulta\n- Abre conta\n\n  * Emite cartão '), ['Informa o CPF', 'Consulta', 'Abre conta', 'Emite cartão']);
});

test('Gherkin: palavras-chave nos três idiomas e "E/And/Y" nos passos seguintes', () => {
  const s = { title: 'Login válido', tags: 'login smoke', given: 'estou na tela de login', when: 'informo e-mail\ninformo a senha', then: 'vejo meus projetos' };
  assert.equal(scenarioToGherkin(s, keywordsFor('pt-BR')), [
    '  @login @smoke', '  Cenário: Login válido', '    Dado estou na tela de login',
    '    Quando informo e-mail', '    E informo a senha', '    Então vejo meus projetos',
  ].join('\n'));
  assert.match(scenarioToGherkin(s, keywordsFor('en')), /Scenario: Login válido\n {4}Given .*\n {4}When .*\n {4}And .*\n {4}Then /);
  assert.match(scenarioToGherkin(s, keywordsFor('es')), /Escenario: .*\n {4}Dado .*\n {4}Cuando .*\n {4}Y .*\n {4}Entonces /);
});

test('Gherkin: com exemplos vira Esquema do Cenário', () => {
  const g = scenarioToGherkin({ title: 'Senha', when: 'informo "<senha>"', then: 'vejo "<msg>"', examples: '| senha | msg |\n| 123 | curta |' }, keywordsFor('pt-BR'));
  assert.match(g, /Esquema do Cenário: Senha/);
  assert.match(g, /Exemplos:\n {6}\| senha \| msg \|\n {6}\| 123 \| curta \|/);
});

test('funcionalidade por história (Como/Quero/Para) e cenários sem história à parte', () => {
  const stories = [{ id: 's1', code: 'US1', title: 'Agendar pelo celular', asA: 'cliente', iWant: 'reservar um horário', soThat: 'não precisar ligar', acceptanceCriteria: '1. recebo e-mail' }];
  const scenarios = [{ userStoryId: 's1', title: 'Horário livre', when: 'escolho um horário' }, { userStoryId: null, title: 'Solto', then: 'ok' }];
  const [f1, f2] = buildFeatures({ stories, scenarios }, 'pt-BR');
  assert.equal(f1.name, 'us1-agendar-pelo-celular.feature');
  assert.match(f1.content, /^# language: pt\n@US1\nFuncionalidade: US1 — Agendar pelo celular\n {2}Como cliente\n {2}Quero reservar um horário\n {2}Para não precisar ligar/);
  assert.match(f1.content, /Critérios de aceitação:\n {4}- recebo e-mail/);
  assert.match(f1.content, /Cenário: Horário livre/);
  assert.match(f2.content, /Funcionalidade: Cenários sem história de usuário/);
  assert.match(buildFeatures({ stories, scenarios: [] }, 'en')[0].content, /^# language: en\n@US1\nFeature: .*\n {2}As a cliente\n {2}I want/);
});

test('rascunho BDD a partir do caso de uso (Guedes: principal, alternativo, exceção)', () => {
  const uc = { id: 'u1', code: 'UC01', name: 'Abrir conta', preconditions: 'O pedido foi aprovado', postconditions: 'É necessário um depósito inicial' };
  const flows = [
    { kind: 'exception', title: 'Cliente menor de idade', position: 2, steps: [{ actor: '', system: 'Recusar o pedido' }] },
    { kind: 'main', title: 'Principal', position: 0, steps: [{ actor: 'Informa o CPF', system: '' }, { actor: '', system: 'Abrir conta' }] },
    { kind: 'alternative', title: 'Cliente sem cadastro', position: 1, steps: [{ actor: 'Pede cadastro', system: 'Executar "Gerenciar Clientes"' }] },
  ];
  const [main, alt, exc] = draftScenarios(uc, flows, 'pt-BR');
  assert.equal(main.title, 'UC01 — Abrir conta: cenário principal');
  assert.equal(main.given, 'O pedido foi aprovado');
  assert.equal(main.when, 'Informa o CPF');
  assert.equal(main.then, 'Abrir conta\nÉ necessário um depósito inicial');
  assert.equal(alt.tags, '@UC01 @alternativo');
  assert.equal(exc.when, 'Cliente menor de idade'); // sem ação do ator, o título é o evento
  assert.equal(exc.then, 'Recusar o pedido');
});

test('OpenAPI documenta a Visão de Sistema', () => {
  const { paths } = buildOpenApi();
  for (const p of ['', '/report', '/features', '/spec', '/stakeholders', '/glossary', '/use-cases', '/use-cases/{id}',
    '/use-cases/{id}/scenarios', '/use-cases/{useCaseId}/flows', '/use-cases/{useCaseId}/flows/{id}', '/relations', '/scenarios']) {
    assert.ok(paths[`/projects/{projectId}/system-view${p}`], p || '/');
  }
});
