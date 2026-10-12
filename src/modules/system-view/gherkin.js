// Gherkin (BDD) a partir das histórias de usuário e dos cenários da Visão de Sistema.
// Os passos ficam guardados sem palavra-chave; aqui recebem Dado/Quando/Então no idioma pedido.
// Palavras-chave conforme a referência oficial do Gherkin (cucumber.io, i18n "pt", "en", "es").

export const KEYWORDS = {
  'pt-BR': {
    language: 'pt', feature: 'Funcionalidade', background: 'Contexto', scenario: 'Cenário',
    outline: 'Esquema do Cenário', examples: 'Exemplos', given: 'Dado', when: 'Quando', then: 'Então',
    and: 'E', asA: 'Como', iWant: 'Quero', soThat: 'Para', main: 'cenário principal',
    noStory: 'Cenários sem história de usuário', acceptance: 'Critérios de aceitação',
  },
  en: {
    language: 'en', feature: 'Feature', background: 'Background', scenario: 'Scenario',
    outline: 'Scenario Outline', examples: 'Examples', given: 'Given', when: 'When', then: 'Then',
    and: 'And', asA: 'As a', iWant: 'I want', soThat: 'So that', main: 'main scenario',
    noStory: 'Scenarios without a user story', acceptance: 'Acceptance criteria',
  },
  es: {
    language: 'es', feature: 'Característica', background: 'Antecedentes', scenario: 'Escenario',
    outline: 'Esquema del escenario', examples: 'Ejemplos', given: 'Dado', when: 'Cuando', then: 'Entonces',
    and: 'Y', asA: 'Como', iWant: 'Quiero', soThat: 'Para', main: 'escenario principal',
    noStory: 'Escenarios sin historia de usuario', acceptance: 'Criterios de aceptación',
  },
};
export const keywordsFor = (lang) => KEYWORDS[lang] ?? KEYWORDS['pt-BR'];

// Texto multilinha → passos, sem numeração ("1." "2)") nem marcadores ("-" "*")
export const lines = (text) =>
  String(text ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(\d+[.)]|[-*•])\s*/, '').trim())
    .filter(Boolean);

// Depois da palavra-chave o passo continua a frase: "Dado o pedido..." (siglas como "CPF" ficam)
export const continueSentence = (l) => (/^\p{Lu}(?!\p{Lu})/u.test(l) ? l[0].toLocaleLowerCase('pt-BR') + l.slice(1) : l);

const steps = (kw, keyword, text, indent) =>
  lines(text).map((l, i) => `${indent}${i === 0 ? kw[keyword] : kw.and} ${continueSentence(l)}`);

export function scenarioToGherkin(s, kw, indent = '  ') {
  const out = [];
  const tags = String(s.tags ?? '').split(/\s+/).filter(Boolean).map((t) => (t.startsWith('@') ? t : `@${t}`));
  if (tags.length) out.push(indent + tags.join(' '));
  const examples = lines(s.examples).filter((l) => l.startsWith('|'));
  out.push(`${indent}${examples.length ? kw.outline : kw.scenario}: ${s.title}`);
  const inner = indent + '  ';
  out.push(...steps(kw, 'given', s.given, inner), ...steps(kw, 'when', s.when, inner), ...steps(kw, 'then', s.then, inner));
  if (examples.length) {
    out.push('', `${inner}${kw.examples}:`, ...examples.map((l) => `${inner}  ${l}`));
  }
  return out.join('\n');
}

// Uma funcionalidade (.feature) por história; cenários sem história ficam numa funcionalidade à parte
export function buildFeatures({ stories, scenarios }, lang) {
  const kw = keywordsFor(lang);
  const byStory = Object.groupBy(scenarios, (s) => s.userStoryId ?? 'none');
  const features = [];

  for (const story of stories) {
    const body = [`# language: ${kw.language}`, `@${story.code}`, `${kw.feature}: ${story.code} — ${story.title}`];
    body.push(`  ${kw.asA} ${story.asA}`, `  ${kw.iWant} ${story.iWant}`);
    if (story.soThat) body.push(`  ${kw.soThat} ${story.soThat}`);
    const criteria = lines(story.acceptanceCriteria);
    if (criteria.length) body.push('', `  ${kw.acceptance}:`, ...criteria.map((c) => `    - ${c}`));
    for (const s of byStory[story.id] ?? []) body.push('', scenarioToGherkin(s, kw));
    features.push({ name: `${slug(story.code)}-${slug(story.title)}.feature`, userStoryId: story.id, content: body.join('\n') + '\n' });
  }

  const orphans = byStory.none ?? [];
  if (orphans.length) {
    const body = [`# language: ${kw.language}`, `${kw.feature}: ${kw.noStory}`];
    for (const s of orphans) body.push('', scenarioToGherkin(s, kw));
    features.push({ name: 'outros-cenarios.feature', userStoryId: null, content: body.join('\n') + '\n' });
  }
  return features;
}

// Rascunho de cenários a partir de um caso de uso (Guedes: cenário principal = caminho feliz;
// cada cenário alternativo ou de exceção vira um cenário próprio)
export function draftScenarios(useCase, flows, lang) {
  const kw = keywordsFor(lang);
  const actorSteps = (f) => f.steps.map((s) => s.actor).filter(Boolean);
  const systemSteps = (f) => f.steps.map((s) => s.system).filter(Boolean);
  const ordered = [...flows].sort((a, b) => FLOW_ORDER[a.kind] - FLOW_ORDER[b.kind] || a.position - b.position);

  return ordered.map((f) => {
    const actor = actorSteps(f);
    const system = systemSteps(f);
    const isMain = f.kind === 'main';
    return {
      title: `${useCase.code} — ${useCase.name}: ${isMain ? kw.main : f.title}`,
      useCaseId: useCase.id,
      tags: `@${useCase.code}${isMain ? '' : f.kind === 'exception' ? ' @excecao' : ' @alternativo'}`,
      given: useCase.preconditions ?? null,
      // sem ação do ator, o próprio título do cenário descreve o evento
      when: (actor.length ? actor : [f.title]).join('\n'),
      then: [...system, ...(isMain ? lines(useCase.postconditions) : [])].join('\n') || null,
    };
  });
}
const FLOW_ORDER = { main: 0, alternative: 1, exception: 2 };

export const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'feature';
