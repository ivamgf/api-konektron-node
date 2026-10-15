import { db } from '#database/connection.js';
import { insertAt, nextPosition, renumber } from '#shared/ordering.js';
import { assertAllInProject, assertInProject } from '#shared/projectRefs.js';
import { AppError } from '#utils/AppError.js';

const SETTINGS_FIELDS = [
  'vision', 'productGoal', 'definitionOfReady', 'definitionOfDone', 'sprintLengthDays', 'startDate', 'workingAgreements', 'notes',
];
const EMPTY_SETTINGS = Object.fromEntries(SETTINGS_FIELDS.map((f) => [f, null]));
const sum = (rows, key) => rows.reduce((n, r) => n + (Number(r[key]) || 0), 0);
const dayOf = (d) => (d instanceof Date ? d.toISOString() : String(d)).slice(0, 10);

// "done" marca a data de conclusão (burndown e velocidade); sair de "done" limpa
export function stampDone(data, id) {
  if (data.status === undefined) return;
  if (data.status !== 'done') data.doneAt = null;
  else data.doneAt = id ? db.raw('coalesce(done_at, now())') : db.fn.now();
}

export const scrumService = {
  async getSettings(projectId) {
    const row = await db('scrum_settings').where({ projectId }).first(...SETTINGS_FIELDS, 'updatedAt');
    return row ?? { ...EMPTY_SETTINGS, sprintLengthDays: 14, updatedAt: null };
  },

  async updateSettings(projectId, data) {
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    const [row] = await db('scrum_settings')
      .insert({ projectId, ...data })
      .onConflict('projectId')
      .merge(Object.keys(data))
      .returning([...SETTINGS_FIELDS, 'updatedAt']);
    return row;
  },

  // ---------- Vínculos ----------
  async assertItemRefs(trx, projectId, data) {
    await assertInProject(trx, 'scrum_sprints', projectId, data.sprintId, 'sprintId');
  },
  async assertTaskRefs(trx, projectId, data) {
    await assertInProject(trx, 'scrum_sprints', projectId, data.sprintId, 'sprintId');
    await assertInProject(trx, 'scrum_items', projectId, data.itemId, 'itemId');
    await assertInProject(trx, 'scrum_members', projectId, data.assigneeId, 'assigneeId');
  },
  async assertEventRefs(trx, projectId, data) {
    await assertInProject(trx, 'scrum_sprints', projectId, data.sprintId, 'sprintId');
    await assertInProject(trx, 'scrum_members', projectId, data.facilitatorId, 'facilitatorId');
    const participants = data.participantIds && JSON.parse(data.participantIds);
    await assertAllInProject(trx, 'scrum_members', projectId, participants, 'participantIds');
    const updates = data.updates && JSON.parse(data.updates);
    await assertAllInProject(trx, 'scrum_members', projectId, updates?.map((u) => u.memberId), 'updates');
  },
  nextItemPosition: (trx, projectId) => nextPosition(trx, 'scrum_items', { projectId }),

  // Fim não pode vir antes do início (no PATCH, compara com o valor gravado)
  async assertSprintDates(trx, data, id) {
    if (data.startDate === undefined && data.endDate === undefined) return;
    const current = id ? await trx('scrum_sprints').where({ id }).first('startDate', 'endDate') : {};
    const start = data.startDate !== undefined ? data.startDate : current?.startDate;
    const end = data.endDate !== undefined ? data.endDate : current?.endDate;
    if (start && end && dayOf(end) < dayOf(start)) {
      throw new AppError('Dados inválidos', 422, { endDate: ['O fim da sprint deve ser depois do início'] });
    }
  },

  // Membro excluído sai das listas de participantes dos eventos
  removeMemberFromEvents(trx, projectId, id) {
    return trx.raw(
      'update scrum_events set participant_ids = participant_ids - ?::text where project_id = ? and participant_ids @> ?::jsonb',
      [id, projectId, JSON.stringify([id])],
    );
  },

  // Reordena o Product Backlog (ordem = prioridade)
  async moveItem(projectId, itemId, position) {
    await db.transaction(async (trx) => {
      await trx('scrum_items').where({ projectId }).forUpdate().select('id');
      const rows = await trx('scrum_items').where({ projectId }).orderBy(['position', 'createdAt']).select('id', 'position');
      if (!rows.some((r) => r.id === itemId)) throw AppError.notFound('Item');
      await renumber(trx, 'scrum_items', rows, insertAt(rows.map((r) => r.id), itemId, position));
    });
    return db('scrum_items').where({ projectId }).orderBy(['position', 'createdAt']);
  },

  // Sprint com o seu backlog, tasks e eventos
  async sprintDetail(projectId, sprintId) {
    const sprint = await db('scrum_sprints').where({ id: sprintId, projectId }).first();
    if (!sprint) throw AppError.notFound('Sprint');
    const [items, tasks, events] = await Promise.all([
      db('scrum_items').where({ sprintId }).orderBy(['position', 'createdAt']),
      db('scrum_tasks').where({ sprintId }).orderBy(['position', 'createdAt']),
      db('scrum_events').where({ sprintId }).orderBy([{ column: 'date' }, { column: 'createdAt' }]),
    ]);
    return { ...sprint, items, tasks, events, burndown: this.burndown(sprint, items) };
  },

  // Pontos restantes por dia da sprint (ideal × real), a partir da data de conclusão dos itens
  burndown(sprint, items) {
    if (!sprint.startDate || !sprint.endDate) return null;
    const start = new Date(`${dayOf(sprint.startDate)}T00:00:00Z`);
    const end = new Date(`${dayOf(sprint.endDate)}T00:00:00Z`);
    const days = Math.round((end - start) / 86_400_000);
    if (days < 0 || days > 120) return null;
    const total = sum(items, 'storyPoints');
    const today = new Date().toISOString().slice(0, 10);
    const points = [];
    for (let i = 0; i <= days; i += 1) {
      const day = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      const done = sum(items.filter((it) => it.doneAt && dayOf(it.doneAt) <= day), 'storyPoints');
      points.push({
        day,
        ideal: Math.round((total - (total * i) / Math.max(days, 1)) * 10) / 10,
        remaining: day <= today ? total - done : null,
      });
    }
    return { total, points };
  },

  async overview(projectId) {
    const [settings, members, sprints, items, tasks, events] = await Promise.all([
      this.getSettings(projectId),
      db('scrum_members').where({ projectId }).select('id', 'role', 'active'),
      db('scrum_sprints').where({ projectId }).orderBy('number'),
      db('scrum_items').where({ projectId }).select('id', 'status', 'storyPoints', 'sprintId', 'doneAt'),
      db('scrum_tasks').where({ projectId }).select('sprintId', 'status', 'remainingHours', 'estimateHours'),
      db('scrum_events').where({ projectId }).select('type'),
    ]);
    const roles = Object.fromEntries(['product_owner', 'scrum_master', 'developer', 'stakeholder'].map((r) => [r, 0]));
    for (const m of members) if (m.active !== false) roles[m.role] += 1;
    // velocidade: pontos dos itens concluídos em cada sprint encerrada
    const velocity = sprints
      .filter((s) => s.status === 'completed')
      .map((s) => ({
        number: s.number,
        name: s.name,
        committed: sum(items.filter((i) => i.sprintId === s.id), 'storyPoints'),
        done: sum(items.filter((i) => i.sprintId === s.id && i.status === 'done'), 'storyPoints'),
      }));
    const current = sprints.find((s) => s.status === 'active') ?? sprints.find((s) => s.status === 'planned') ?? null;
    let currentSprint = null;
    if (current) {
      const sprintItems = items.filter((i) => i.sprintId === current.id);
      const sprintTasks = tasks.filter((t) => t.sprintId === current.id);
      currentSprint = {
        ...current,
        items: sprintItems.length,
        points: sum(sprintItems, 'storyPoints'),
        donePoints: sum(sprintItems.filter((i) => i.status === 'done'), 'storyPoints'),
        tasks: Object.fromEntries(['todo', 'in_progress', 'done'].map((st) => [st, sprintTasks.filter((t) => t.status === st).length])),
        remainingHours: sum(sprintTasks.filter((t) => t.status !== 'done'), 'remainingHours'),
        burndown: this.burndown(current, sprintItems),
      };
    }
    const productBacklog = items.filter((i) => !i.sprintId && i.status !== 'done');
    return {
      settings,
      roles,
      counts: {
        members: members.length,
        sprints: sprints.length,
        productBacklog: productBacklog.length,
        productBacklogPoints: sum(productBacklog, 'storyPoints'),
        events: events.length,
      },
      eventsByType: Object.fromEntries(['planning', 'daily', 'review', 'retrospective', 'refinement'].map((t) => [t, events.filter((e) => e.type === t).length])),
      velocity,
      averageVelocity: velocity.length ? Math.round((sum(velocity, 'done') / velocity.length) * 10) / 10 : null,
      currentSprint,
    };
  },
};
