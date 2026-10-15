// Ordenação manual por `position` (0..n-1): quadro Kanban, Product Backlog...

// Reescreve as posições na ordem de `ids`, tocando só as linhas que mudaram
export async function renumber(trx, table, rows, ids, extra = {}) {
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
export const insertAt = (ids, id, position) => {
  const out = ids.filter((x) => x !== id);
  out.splice(Math.min(position, out.length), 0, id);
  return out;
};

export async function nextPosition(trx, table, where) {
  const row = await trx(table).where(where).max({ max: 'position' }).first();
  return row?.max == null ? 0 : row.max + 1;
}
