import { db } from '#database/connection.js';
import { nextPosition, renumber } from '#shared/ordering.js';
import { AppError } from '#utils/AppError.js';
import { TASK_STATUS } from './scrum.schemas.js';

// Ligação Scrum ↔ Kanban: as tasks da sprint são publicadas como cartões. Cada coluna do quadro pode
// corresponder a uma situação da task (`taskStatus`); mover o cartão para uma dessas colunas muda a
// task, e mudar a task no Scrum leva o cartão para a coluna correspondente.

// Trava as colunas do projeto, como o Kanban faz nos movimentos
const lockBoard = (trx, projectId) => trx('kanban_columns').where({ projectId }).forUpdate().select('id');

const columnsOf = (trx, projectId) =>
  trx('kanban_columns').where({ projectId }).orderBy([{ column: 'position' }, { column: 'createdAt' }]);

// Coluna de cada situação: a primeira marcada com ela; sem marcação, a primeira coluna recebe o que
// está "a fazer" e "em andamento" e a última o que está "feito"
export function columnFor(columns, status) {
  const marked = columns.find((c) => c.taskStatus === status);
  if (marked) return marked;
  if (!columns.length) return null;
  if (status === 'done') return columns.at(-1);
  if (status === 'in_progress') return columns.find((c) => c.taskStatus === 'todo') ?? columns[0];
  return columns[0];
}

// Quadro sem correspondências: marca pela ordem (1ª = a fazer, 2ª = em andamento se houver 3 ou mais, última = feito)
export function autoMap(columns) {
  if (!columns.length || columns.some((c) => c.taskStatus)) return [];
  const map = [[columns[0], 'todo'], [columns.at(-1), 'done']];
  if (columns.length >= 3) map.push([columns[1], 'in_progress']);
  return columns.length === 1 ? [[columns[0], 'todo']] : map;
}

// Situação da task e o que vem junto (data de conclusão, horas restantes zeradas)
export function taskStatusChange(status) {
  return {
    status,
    doneAt: status === 'done' ? db.raw('coalesce(done_at, now())') : null,
    ...(status === 'done' && { remainingHours: 0 }),
  };
}

// Situação do item a partir das tasks dele: todas concluídas → item concluído (entra no incremento e no
// burndown); alguma reaberta → item volta para "em andamento"; alguma iniciada → item novo/preparado passa
// a "em andamento". Item sem tasks não muda.
export async function rollupItem(trx, itemId) {
  if (!itemId) return;
  const [item, tasks] = await Promise.all([
    trx('scrum_items').where({ id: itemId }).first('id', 'status'),
    trx('scrum_tasks').where({ itemId }).select('status'),
  ]);
  if (!item || !tasks.length) return;
  const allDone = tasks.every((tk) => tk.status === 'done');
  const started = tasks.some((tk) => tk.status !== 'todo');
  let status = null;
  if (allDone) status = 'done';
  else if (item.status === 'done' || (started && ['new', 'ready'].includes(item.status))) status = 'in_progress';
  if (!status || status === item.status) return;
  await trx('scrum_items')
    .where({ id: itemId })
    .update({ status, doneAt: status === 'done' ? db.raw('coalesce(done_at, now())') : null });
}

// Leva o cartão para o fim de outra coluna e fecha o espaço na de origem
async function moveCardToEnd(trx, card, columnId) {
  const cardsOf = (id) => trx('kanban_cards').where({ columnId: id }).orderBy(['position', 'createdAt']).select('id', 'position', 'columnId');
  const target = await cardsOf(columnId);
  await renumber(trx, 'kanban_cards', target, [...target.map((c) => c.id), card.id], { columnId });
  const source = await cardsOf(card.columnId);
  await renumber(trx, 'kanban_cards', source, source.map((c) => c.id));
}

export const scrumKanban = {
  // Publica no Kanban as tasks da sprint que ainda não estão lá. Itens do Sprint Backlog sem tasks
  // ganham uma task com o próprio título. Quadro vazio ganha as colunas padrão (nomes do cliente).
  async publishSprint(projectId, sprintId, { columnNames } = {}) {
    return db.transaction(async (trx) => {
      const sprint = await trx('scrum_sprints').where({ id: sprintId, projectId }).first();
      if (!sprint) throw AppError.notFound('Sprint');
      // trava o projeto (um quadro vazio não tem colunas para travar) e o quadro
      await trx('projects').where({ id: projectId }).forUpdate().select('id');
      await lockBoard(trx, projectId);

      // itens sem task viram uma task cada
      const items = await trx('scrum_items').where({ sprintId }).orderBy(['position', 'createdAt']);
      const withTasks = new Set((await trx('scrum_tasks').where({ sprintId }).distinct('itemId')).map((r) => r.itemId));
      const bare = items.filter((i) => !withTasks.has(i.id));
      let position = await nextPosition(trx, 'scrum_tasks', { sprintId });
      for (const item of bare) {
        const status = item.status === 'done' ? 'done' : item.status === 'in_progress' ? 'in_progress' : 'todo';
        await trx('scrum_tasks').insert({
          projectId, sprintId, itemId: item.id, title: item.title, description: item.description,
          position: position++, ...taskStatusChange(status), ...(status === 'done' && { doneAt: item.doneAt ?? db.fn.now() }),
        });
      }

      const pending = await trx('scrum_tasks as t')
        .leftJoin('kanban_cards as c', 'c.scrum_task_id', 't.id')
        .where('t.sprint_id', sprintId)
        .whereNull('c.id')
        .orderBy(['t.position', 't.created_at'])
        .select('t.*');
      if (!pending.length) return { published: 0, createdTasks: bare.length };

      // colunas: cria as padrão num quadro vazio; num quadro sem correspondências, marca pela ordem
      let columns = await columnsOf(trx, projectId);
      if (!columns.length) {
        const names = { todo: 'A fazer', in_progress: 'Fazendo', done: 'Feito', ...columnNames };
        await trx('kanban_columns').insert(
          TASK_STATUS.map((status, i) => ({ projectId, name: names[status].slice(0, 60), position: i, taskStatus: status })),
        );
        columns = await columnsOf(trx, projectId);
      } else {
        for (const [column, status] of autoMap(columns)) {
          await trx('kanban_columns').where({ id: column.id }).update({ taskStatus: status });
          column.taskStatus = status;
        }
      }

      const members = Object.fromEntries((await trx('scrum_members').where({ projectId }).select('id', 'name')).map((m) => [m.id, m.name]));
      const next = {};
      for (const task of pending) {
        const column = columnFor(columns, task.status);
        next[column.id] ??= await nextPosition(trx, 'kanban_cards', { columnId: column.id });
        await trx('kanban_cards').insert({
          projectId,
          columnId: column.id,
          scrumTaskId: task.id,
          title: task.title,
          description: task.description,
          assignee: members[task.assigneeId]?.slice(0, 120) ?? null,
          dueDate: sprint.endDate,
          position: next[column.id]++,
        });
      }
      return { published: pending.length, createdTasks: bare.length };
    });
  },

  // Task alterada no Scrum: atualiza o cartão (título, descrição, responsável) e o leva para a coluna da nova situação
  async syncTaskToCard(trx, projectId, taskId, data) {
    const card = await trx('kanban_cards').where({ scrumTaskId: taskId, projectId }).first('id', 'columnId');
    if (!card) return;
    const patch = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.assigneeId !== undefined) {
      const member = data.assigneeId && (await trx('scrum_members').where({ id: data.assigneeId }).first('name'));
      patch.assignee = member?.name.slice(0, 120) ?? null;
    }
    if (Object.keys(patch).length) await trx('kanban_cards').where({ id: card.id }).update(patch);

    if (data.status === undefined) return;
    await lockBoard(trx, projectId);
    const columns = await columnsOf(trx, projectId);
    const current = columns.find((c) => c.id === card.columnId);
    if (current?.taskStatus === data.status) return;
    const target = columnFor(columns, data.status);
    if (target && target.id !== card.columnId) await moveCardToEnd(trx, card, target.id);
  },

  // Cartão movido no Kanban: a task assume a situação da coluna (colunas sem correspondência não mudam nada)
  async syncCardMoveToTask(trx, cardId, columnId) {
    const [card, column] = await Promise.all([
      trx('kanban_cards').where({ id: cardId }).first('scrumTaskId'),
      trx('kanban_columns').where({ id: columnId }).first('taskStatus'),
    ]);
    if (!card?.scrumTaskId || !column?.taskStatus) return;
    const [task] = await trx('scrum_tasks')
      .where({ id: card.scrumTaskId })
      .whereNot({ status: column.taskStatus })
      .update(taskStatusChange(column.taskStatus))
      .returning('itemId');
    if (task) await rollupItem(trx, task.itemId);
  },

  // Cartão editado no Kanban: título e descrição voltam para a task
  async syncCardEditToTask(trx, cardId, data) {
    const patch = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (!Object.keys(patch).length) return;
    const card = await trx('kanban_cards').where({ id: cardId }).first('scrumTaskId');
    if (card?.scrumTaskId) await trx('scrum_tasks').where({ id: card.scrumTaskId }).update(patch);
  },
};
