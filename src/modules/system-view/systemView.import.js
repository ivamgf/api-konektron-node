import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import { lines } from './gherkin.js';

// Importação para a Visão de Sistema a partir de um projeto da Análise de Sistemas (o próprio ou
// outro projeto `software` do usuário), para não redigitar requisitos, histórias e diagramas.
// Nada é sobrescrito: registros com o mesmo código (ou título) já existentes são mantidos e contados
// como "pulados". Campos de texto da análise e das definições só são preenchidos se estiverem vazios.
// Com `dryRun`, tudo roda numa transação desfeita no fim: a prévia mostra exatamente o resultado.

const DEFAULT_ACTOR = { 'pt-BR': 'Usuário', en: 'User', es: 'Usuario' };
const MAIN_FLOW = { 'pt-BR': 'Cenário principal', en: 'Main scenario', es: 'Escenario principal' };
const ANALYSIS_FIELDS = ['goal', 'scope', 'technicalDescription', 'notes'];
const SPEC_FIELDS = ['responsible', 'organization', 'purpose', 'productPerspective', 'userCharacteristics', 'constraints', 'assumptions', 'references'];
const OMIT = ['id', 'projectId', 'createdAt', 'updatedAt'];

const strip = (row, extra = []) => Object.fromEntries(Object.entries(row).filter(([k]) => !OMIT.includes(k) && !extra.includes(k)));
const counter = () => ({ created: 0, skipped: 0 });
const capitalize = (s) => (s ? s[0].toLocaleUpperCase('pt-BR') + s.slice(1) : s);
const isEmpty = (v) => v == null || String(v).trim() === '';

// Próximo código livre com prefixo e largura (UC001, P3...)
function nextCode(existing, prefix, width) {
  const nums = existing.map((c) => Number(String(c).slice(prefix.length))).filter(Number.isFinite);
  let n = Math.max(0, ...nums);
  return () => `${prefix}${String(++n).padStart(width, '0')}`;
}

class DryRun extends Error {
  constructor(summary) {
    super('dry-run');
    this.summary = summary;
  }
}

async function fillEmpty(trx, table, projectId, fields, source) {
  const current = (await trx(table).where({ projectId }).first()) ?? {};
  const patch = Object.fromEntries(fields.filter((f) => isEmpty(current[f]) && !isEmpty(source?.[f])).map((f) => [f, source[f]]));
  if (!Object.keys(patch).length) return 0;
  await trx(table).insert({ projectId, ...patch }).onConflict('projectId').merge(Object.keys(patch));
  return Object.keys(patch).length;
}

// Copia linhas de uma tabela por código/título, devolvendo o mapa id de origem → id de destino
// (create = false: só associa os códigos que já existem no destino, sem criar nada)
async function copyByKey(trx, table, { from, to, key, map = (r) => r, count, create = true }) {
  const ids = {};
  const target = await trx(table).where({ projectId: to });
  const byKey = Object.fromEntries(target.map((r) => [r[key], r.id]));
  for (const row of await trx(table).where({ projectId: from }).orderBy('createdAt')) {
    if (byKey[row[key]]) {
      ids[row.id] = byKey[row[key]];
      if (create) count.skipped++;
      continue;
    }
    if (!create) continue;
    const [created] = await trx(table).insert({ ...map(strip(row), row), projectId: to }).returning('id');
    ids[row.id] = created.id;
    byKey[row[key]] = created.id;
    count.created++;
  }
  return ids;
}

export async function importFromAnalysis(target, user, opts) {
  const { sourceProjectId, lang = 'pt-BR', dryRun = false } = opts;
  const source = await db('projects').where({ id: sourceProjectId }).whereNull('deletedAt').first();
  if (!source || (source.ownerId !== user.id && user.role !== 'admin')) throw AppError.notFound('Projeto de origem');
  if (source.type !== 'software') throw new AppError('O projeto de origem precisa ser do tipo "software"', 409);
  const same = source.id === target.id;
  const want = (k) => opts[k] !== false; // tudo marcado por padrão

  const summary = {
    source: { id: source.id, name: source.name, same },
    analysis: 0, requirements: counter(), userStories: counter(), diagrams: counter(),
    spec: 0, stakeholders: counter(), glossary: counter(), useCases: counter(), flows: 0, relations: counter(), scenarios: counter(),
    generatedUseCases: [], generatedStakeholders: [],
    dryRun,
  };

  try {
    await db.transaction(async (trx) => {
      const from = source.id;
      const to = target.id;
      let reqIds = {};
      let storyIds = {};
      let ucIds = {};

      // ---------- Dados da Análise de Sistemas (só de outro projeto) ----------
      if (!same) {
        if (want('analysis')) {
          summary.analysis = await fillEmpty(trx, 'system_analyses', to, ANALYSIS_FIELDS, await trx('system_analyses').where({ projectId: from }).first());
        }
        // mesmo sem copiar requisitos, o mapa por código religa histórias e casos de uso aos que já existem
        reqIds = await copyByKey(trx, 'requirements', { from, to, key: 'code', count: summary.requirements, create: want('requirements') });
        storyIds = await copyByKey(trx, 'user_stories', {
          from, to, key: 'code', count: summary.userStories, create: want('userStories'),
          map: (r) => ({ ...r, requirementId: r.requirementId ? (reqIds[r.requirementId] ?? null) : null }),
        });
        if (want('diagrams')) {
          const existing = new Set((await trx('diagrams').where({ projectId: to })).map((d) => `${d.type}|${d.title}`));
          for (const d of await trx('diagrams').where({ projectId: from }).orderBy('createdAt')) {
            if (existing.has(`${d.type}|${d.title}`)) { summary.diagrams.skipped++; continue; }
            await trx('diagrams').insert({ ...strip(d), projectId: to });
            summary.diagrams.created++;
          }
        }

        // ---------- Visão de Sistema já feita no outro projeto ----------
        if (want('systemView')) {
          summary.spec = await fillEmpty(trx, 'system_specs', to, SPEC_FIELDS, await trx('system_specs').where({ projectId: from }).first());
          await copyByKey(trx, 'stakeholders', { from, to, key: 'code', count: summary.stakeholders });
          await copyByKey(trx, 'glossary_terms', { from, to, key: 'code', count: summary.glossary });
          const before = new Set(await trx('use_cases').where({ projectId: to }).pluck('id'));
          ucIds = await copyByKey(trx, 'use_cases', {
            from, to, key: 'code', count: summary.useCases,
            // generalização é religada depois que todos existirem
            map: (r) => ({
              ...r,
              generalUseCaseId: null,
              requirementIds: JSON.stringify((r.requirementIds ?? []).map((id) => reqIds[id]).filter(Boolean)),
            }),
          });
          for (const uc of await trx('use_cases').where({ projectId: from }).whereNotNull('generalUseCaseId')) {
            const id = ucIds[uc.id];
            if (id && !before.has(id) && ucIds[uc.generalUseCaseId]) {
              await trx('use_cases').where({ id }).update({ generalUseCaseId: ucIds[uc.generalUseCaseId] });
            }
          }
          // cenários dos casos de uso criados agora
          for (const [srcId, dstId] of Object.entries(ucIds)) {
            if (before.has(dstId)) continue;
            for (const f of await trx('use_case_flows').where({ useCaseId: srcId }).orderBy('position')) {
              await trx('use_case_flows').insert({ ...strip(f, ['useCaseId']), useCaseId: dstId, steps: JSON.stringify(f.steps) });
              summary.flows++;
            }
          }
          const rels = new Set((await trx('use_case_relations').where({ projectId: to })).map((r) => `${r.fromUseCaseId}|${r.toUseCaseId}|${r.type}`));
          for (const r of await trx('use_case_relations').where({ projectId: from })) {
            const a = ucIds[r.fromUseCaseId];
            const b = ucIds[r.toUseCaseId];
            if (!a || !b || rels.has(`${a}|${b}|${r.type}`)) { summary.relations.skipped++; continue; }
            await trx('use_case_relations').insert({ ...strip(r), projectId: to, fromUseCaseId: a, toUseCaseId: b });
            rels.add(`${a}|${b}|${r.type}`);
            summary.relations.created++;
          }
          const titles = new Set(await trx('bdd_scenarios').where({ projectId: to }).pluck('title'));
          let pos = ((await trx('bdd_scenarios').where({ projectId: to }).max({ max: 'position' }).first())?.max ?? -1) + 1;
          for (const s of await trx('bdd_scenarios').where({ projectId: from }).orderBy(['position', 'createdAt'])) {
            if (titles.has(s.title)) { summary.scenarios.skipped++; continue; }
            await trx('bdd_scenarios').insert({
              ...strip(s), projectId: to, position: pos++,
              userStoryId: s.userStoryId ? (storyIds[s.userStoryId] ?? null) : null,
              useCaseId: s.useCaseId ? (ucIds[s.useCaseId] ?? null) : null,
            });
            titles.add(s.title);
            summary.scenarios.created++;
          }
        }
      }

      // ---------- Rascunhos gerados a partir dos dados do destino ----------
      const stories = await trx('user_stories').where({ projectId: to }).orderBy('code');

      if (want('generateUseCases')) {
        const useCases = await trx('use_cases').where({ projectId: to });
        const covered = new Set(useCases.flatMap((u) => u.requirementIds ?? []));
        const next = nextCode(useCases.map((u) => u.code).filter((c) => /^UC\d+$/.test(c)), 'UC', 3);
        const functional = await trx('requirements').where({ projectId: to, type: 'functional' }).orderBy('code');
        for (const req of functional.filter((r) => !covered.has(r.id))) {
          const story = stories.find((s) => s.requirementId === req.id);
          const summaryText = req.description
            ?? (story ? `${story.asA}: ${story.iWant}${story.soThat ? ` (${story.soThat})` : ''}` : null);
          const [uc] = await trx('use_cases').insert({
            projectId: to,
            code: next(),
            name: req.title,
            primaryActor: story ? capitalize(story.asA.trim()) : DEFAULT_ACTOR[lang] ?? DEFAULT_ACTOR['pt-BR'],
            summary: summaryText,
            requirementIds: JSON.stringify([req.id]),
            priority: req.priority,
          }).returning(['id', 'code']);
          // cenário principal de partida: a ação da história e os critérios de aceitação
          if (story) {
            const steps = [{ actor: capitalize(story.iWant.trim()), system: '' }, ...lines(story.acceptanceCriteria).map((c) => ({ actor: '', system: c }))];
            await trx('use_case_flows').insert({ useCaseId: uc.id, kind: 'main', title: MAIN_FLOW[lang] ?? MAIN_FLOW['pt-BR'], position: 0, steps: JSON.stringify(steps) });
            summary.flows++;
          }
          summary.generatedUseCases.push(`${uc.code} — ${req.code}`);
        }
      }

      if (want('generateStakeholders')) {
        const current = await trx('stakeholders').where({ projectId: to });
        const names = new Set(current.map((s) => s.name.trim().toLocaleLowerCase('pt-BR')));
        const next = nextCode(current.map((s) => s.code).filter((c) => /^P\d+$/.test(c)), 'P', 1);
        for (const role of [...new Set(stories.map((s) => capitalize(s.asA.trim())))]) {
          if (names.has(role.toLocaleLowerCase('pt-BR'))) continue;
          const code = next();
          await trx('stakeholders').insert({ projectId: to, code, name: role });
          names.add(role.toLocaleLowerCase('pt-BR'));
          summary.generatedStakeholders.push(`${code} — ${role}`);
        }
      }

      if (dryRun) throw new DryRun(summary);
    });
  } catch (err) {
    if (err instanceof DryRun) return err.summary;
    throw err;
  }
  return summary;
}
