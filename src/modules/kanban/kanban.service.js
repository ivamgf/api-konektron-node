import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';

// Reescreve as posições na ordem de `ids` (0..n-1), tocando só as linhas que mudaram
async function renumber(trx, table, rows, ids, extra = {}) {
  const current = Object.fromEntries(rows.map((r) => [r.id, r]));
  await Promise.all(
    ids.map((id, position) => {
      const row = current[id];
      const changed = !row || row.position !== position || Object.entries(extra).some(([k, v]) => row[k] !== v);
      return changed ? trx(table).where({ id }).update({ position, ...extra }) : null;
    }),
  );
}

// Insere `id` em `ids` na posição pedida (acima do fim vai para o fim)
const insertAt = (ids, id, position) => {
  const out = ids.filter((x) => x !== id);
  out.splice(Math.min(position, out.length), 0, id);
  return out;
};

// Trava as colunas do projeto: movimentos simultâneos no mesmo quadro ficam em fila
const lockBoard = (trx, projectId) => trx('kanban_columns').where({ projectId }).forUpdate().select('id');

export const kanbanService = {
  async board(projectId) {
    const [columns, cards] = await Promise.all([
      db('kanban_columns').where({ projectId }).orderBy([{ column: 'position' }, { column: 'createdAt' }]),
      db('kanban_cards').where({ projectId }).orderBy([{ column: 'position' }, { column: 'createdAt' }]),
    ]);
    const byColumn = Object.groupBy(cards, (c) => c.columnId);
    return { columns: columns.map((c) => ({ ...c, cards: byColumn[c.id] ?? [] })) };
  },

  async nextPosition(trx, table, where) {
    const row = await trx(table).where(where).max({ max: 'position' }).first();
    return row?.max == null ? 0 : row.max + 1;
  },

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
      }
    });
    return this.board(projectId);
  },
};
