import { db } from '#database/connection.js';
import { assertAllInProject, assertInProject, invalid } from '#shared/projectRefs.js';
import { AppError } from '#utils/AppError.js';
import { CHARACTERIZATION, WORKSHEETS } from './commonkads.constants.js';
import { WORKSHEET_CONTENT_SCHEMAS } from './commonkads.schemas.js';

const META = Object.fromEntries(WORKSHEETS.map((w, i) => [w.key, { order: i + 1, ...w, fields: w.fields ?? [] }]));

// Planilha com os valores padrão (projetos ainda sem registro dela)
const withMeta = (key, row) => ({
  ...META[key],
  status: row?.status ?? 'not_started',
  content: row?.content ?? {},
  notes: row?.notes ?? null,
  updatedAt: row?.updatedAt ?? null,
});

const filled = (w) => w.fields.filter((f) => String(w.content[f] ?? '').trim()).length;
const hasBottleneck = (characterization) =>
  Object.keys(CHARACTERIZATION).some((g) => Object.values(characterization?.[g] ?? {}).some((e) => e?.bottleneck));

// Listas de ids que apontam para cada tabela (limpas quando o registro é excluído)
const ID_LISTS = {
  ck_agents: [['ck_tasks', 'agent_ids'], ['ck_agents', 'communicates_with_ids']],
  ck_knowledge: [['ck_tasks', 'knowledge_ids'], ['ck_agents', 'knowledge_ids']],
};

export const commonkadsService = {
  async listWorksheets(projectId) {
    const rows = await db('ck_worksheets').where({ projectId });
    const byKey = Object.fromEntries(rows.map((r) => [r.worksheet, r]));
    return WORKSHEETS.map((w) => withMeta(w.key, byKey[w.key]));
  },

  async getWorksheet(projectId, key) {
    return withMeta(key, await db('ck_worksheets').where({ projectId, worksheet: key }).first());
  },

  // Upsert com merge do conteúdo: só os campos enviados mudam (null apaga)
  async updateWorksheet(projectId, key, { status, notes, content }) {
    const patch = {};
    if (status) patch.status = status;
    if (notes !== undefined) patch.notes = notes;
    let parsed;
    if (content !== undefined) {
      if (!META[key].fields.length) throw invalid('content', 'Esta planilha é preenchida pelos cadastros, não tem conteúdo livre');
      parsed = WORKSHEET_CONTENT_SCHEMAS[key].parse(content); // ZodError -> 422
    }
    if (!Object.keys(patch).length && !parsed) throw new AppError('Nenhum campo para atualizar', 400);

    const merge = { ...patch };
    if (parsed) merge.content = db.raw('ck_worksheets.content || excluded.content');
    const [row] = await db('ck_worksheets')
      .insert({ projectId, worksheet: key, ...patch, content: JSON.stringify(parsed ?? {}) })
      .onConflict(['projectId', 'worksheet'])
      .merge(merge)
      .returning('*');
    return withMeta(key, row);
  },

  // ---------- Vínculos ----------
  async assertTaskRefs(trx, projectId, data) {
    await assertAllInProject(trx, 'ck_agents', projectId, data.agentIds, 'agentIds');
    await assertAllInProject(trx, 'ck_knowledge', projectId, data.knowledgeIds, 'knowledgeIds');
  },

  async assertAgentRefs(trx, projectId, data, selfId) {
    await assertAllInProject(trx, 'ck_knowledge', projectId, data.knowledgeIds, 'knowledgeIds');
    if (selfId && data.communicatesWithIds?.includes(selfId)) {
      throw invalid('communicatesWithIds', 'Um agente não se comunica consigo mesmo');
    }
    await assertAllInProject(trx, 'ck_agents', projectId, data.communicatesWithIds, 'communicatesWithIds');
  },

  async assertTransactionRefs(trx, projectId, data) {
    for (const f of ['fromTaskId', 'toTaskId']) await assertInProject(trx, 'ck_tasks', projectId, data[f], f);
    for (const f of ['senderAgentId', 'receiverAgentId']) await assertInProject(trx, 'ck_agents', projectId, data[f], f);
  },

  // Remove o id excluído das listas jsonb que o citam (operador jsonb - text)
  async removeIdFromLists(trx, table, projectId, id) {
    for (const [target, column] of ID_LISTS[table] ?? []) {
      await trx.raw(`update ${target} set ${column} = ${column} - ?::text where project_id = ? and ${column} @> ?::jsonb`, [
        id, projectId, JSON.stringify([id]),
      ]);
    }
  },

  // ---------- Visão geral e documento ----------
  async overview(projectId) {
    const [worksheets, tasks, knowledge, agents, transactions] = await Promise.all([
      this.listWorksheets(projectId),
      db('ck_tasks').where({ projectId }).select('code', 'agentIds', 'knowledgeIds', 'knowledgeIntensive'),
      db('ck_knowledge').where({ projectId }).select('id', 'name', 'characterization'),
      db('ck_agents').where({ projectId }).select('id', 'name', 'kind'),
      db('ck_transactions').where({ projectId }).select('code', 'senderAgentId', 'receiverAgentId'),
    ]);
    const usedKnowledge = new Set(tasks.flatMap((t) => t.knowledgeIds));
    const engaged = new Set(tasks.flatMap((t) => t.agentIds));
    const completed = worksheets.filter((w) => w.status === 'completed').length;
    return {
      progress: Math.round((completed / worksheets.length) * 100),
      worksheets: worksheets.map((w) => ({
        key: w.key, model: w.model, order: w.order, resource: w.resource ?? null, status: w.status,
        filled: filled(w), fields: w.fields.length, updatedAt: w.updatedAt,
      })),
      counts: {
        tasks: tasks.length,
        knowledgeIntensiveTasks: tasks.filter((t) => t.knowledgeIntensive).length,
        knowledge: knowledge.length,
        bottlenecks: knowledge.filter((k) => hasBottleneck(k.characterization)).length,
        agents: agents.length,
        humanAgents: agents.filter((a) => a.kind === 'human').length,
        systemAgents: agents.filter((a) => a.kind === 'information_system').length,
        transactions: transactions.length,
      },
      // lacunas entre os modelos, para o engenheiro de conhecimento completar
      gaps: {
        tasksWithoutAgent: tasks.filter((t) => !t.agentIds.length).map((t) => t.code),
        knowledgeNotUsed: knowledge.filter((k) => !usedKnowledge.has(k.id)).map((k) => k.name),
        agentsWithoutTask: agents.filter((a) => !engaged.has(a.id)).map((a) => a.name),
        transactionsWithoutAgents: transactions.filter((t) => !t.senderAgentId || !t.receiverAgentId).map((t) => t.code),
      },
    };
  },

  // Documento completo: planilhas e cadastros com as relações resolvidas nos dois sentidos
  async report(project) {
    const projectId = project.id;
    const [worksheets, tasks, knowledge, agents, transactions] = await Promise.all([
      this.listWorksheets(projectId),
      db('ck_tasks').where({ projectId }).orderBy('code'),
      db('ck_knowledge').where({ projectId }).orderBy('name'),
      db('ck_agents').where({ projectId }).orderBy('name'),
      db('ck_transactions').where({ projectId }).orderBy('code'),
    ]);
    const ref = (rows, label) => Object.fromEntries(rows.map((r) => [r.id, { id: r.id, label: label(r) }]));
    const taskRef = ref(tasks, (t) => `${t.code} — ${t.name}`);
    const agentRef = ref(agents, (a) => a.name);
    const knowledgeRef = ref(knowledge, (k) => k.name);
    const pick = (map, ids) => (ids ?? []).map((id) => map[id]).filter(Boolean);
    const citing = (rows, column, id, map) => rows.filter((r) => r[column]?.includes(id)).map((r) => map[r.id]);

    return {
      generatedAt: new Date().toISOString(),
      project,
      worksheets,
      tasks: tasks.map((t) => ({ ...t, agents: pick(agentRef, t.agentIds), knowledge: pick(knowledgeRef, t.knowledgeIds) })),
      knowledge: knowledge.map((k) => ({
        ...k,
        possessedBy: citing(agents, 'knowledgeIds', k.id, agentRef),
        usedIn: citing(tasks, 'knowledgeIds', k.id, taskRef),
      })),
      agents: agents.map((a) => ({
        ...a,
        engagedIn: citing(tasks, 'agentIds', a.id, taskRef),
        knowledge: pick(knowledgeRef, a.knowledgeIds),
        communicatesWith: pick(agentRef, a.communicatesWithIds),
      })),
      transactions: transactions.map((t) => ({
        ...t,
        fromTask: taskRef[t.fromTaskId] ?? null,
        toTask: taskRef[t.toTaskId] ?? null,
        sender: agentRef[t.senderAgentId] ?? null,
        receiver: agentRef[t.receiverAgentId] ?? null,
      })),
    };
  },
};
