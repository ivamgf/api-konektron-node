import { db } from '#database/connection.js';
import { insertAt, nextPosition, renumber } from '#shared/ordering.js';
import { scrumKanban } from '#modules/scrum/scrum.kanban.js';
import { AppError } from '#utils/AppError.js';

// Trava as colunas do projeto: movimentos simultâneos no mesmo quadro ficam em fila
const lockBoard = (trx, projectId) => trx('kanban_columns').where({ projectId }).forUpdate().select('id');

export const kanbanService = {
  async board(projectId) {
    const [columns, cards] = await Promise.all([
      db('kanban_columns').where({ projectId }).orderBy([{ column: 'position' }, { column: 'createdAt' }]),
      // cartões de tasks do Scrum trazem a sprint e o item de origem
      db('kanban_cards as c')
        .leftJoin('scrum_tasks as t', 't.id', 'c.scrum_task_id')
        .leftJoin('scrum_sprints as s', 's.id', 't.sprint_id')
        .leftJoin('scrum_items as i', 'i.id', 't.item_id')
        .where('c.project_id', projectId)
        .orderBy([{ column: 'c.position' }, { column: 'c.created_at' }])
        .select('c.*', 't.status as task_status', 't.sprint_id', 's.number as sprint_number', 'i.code as item_code'),
    ]);
    const byColumn = Object.groupBy(cards, (c) => c.columnId);
    return { columns: columns.map((c) => ({ ...c, cards: byColumn[c.id] ?? [] })) };
  },

  nextPosition,

  async assertColumnInProject(trx, projectId, columnId) {
    const column = await trx('kanban_columns').where({ id: columnId, projectId }).first('id');
    if (!column) throw new AppError('Coluna não pertence a este projeto', 422, { columnId: 'Coluna inválida' });
  },

  async moveColumn(projectId, columnId, position) {
    await db.transaction(async (trx) => {
      await lockBoard(trx, projectId);
      const rows = await trx('kanban_columns').where({ projectId }).orderBy(['position', 'createdAt']).select('id', 'position');
      if (!rows.some((r) => r.id === columnId)) throw AppError.notFound('Coluna');
      await renumber(trx, 'kanban_columns', rows, insertAt(rows.map((r) => r.id), columnId, position));
    });
    return this.board(projectId);
  },

  async moveCard(projectId, cardId, { columnId, position }) {
    await db.transaction(async (trx) => {
      await lockBoard(trx, projectId);
      const card = await trx('kanban_cards').where({ id: cardId, projectId }).first('id', 'columnId');
      if (!card) throw AppError.notFound('Cartão');
      await this.assertColumnInProject(trx, projectId, columnId);

      const columnCards = (id) =>
        trx('kanban_cards').where({ columnId: id }).orderBy(['position', 'createdAt']).select('id', 'position', 'columnId');
      const target = await columnCards(columnId);
      await renumber(trx, 'kanban_cards', target, insertAt(target.map((c) => c.id), cardId, position), { columnId });

      // fecha o espaço deixado na coluna de origem
      if (card.columnId !== columnId) {
        const source = await columnCards(card.columnId);
        await renumber(trx, 'kanban_cards', source, source.map((c) => c.id));
        // cartão de uma task do Scrum: a task assume a situação da coluna
        await scrumKanban.syncCardMoveToTask(trx, cardId, columnId);
      }
    });
    return this.board(projectId);
  },
};
