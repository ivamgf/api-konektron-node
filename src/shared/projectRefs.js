import { AppError } from '#utils/AppError.js';

// Validações de vínculo entre registros: tudo precisa pertencer ao mesmo projeto
export const invalid = (field, message) => new AppError('Dados inválidos', 422, { [field]: [message] });

export async function assertInProject(trx, table, projectId, id, field) {
  if (id == null) return;
  const row = await trx(table).where({ id, projectId }).first('id');
  if (!row) throw invalid(field, 'Registro não encontrado neste projeto');
}

export async function assertAllInProject(trx, table, projectId, ids, field) {
  if (!ids?.length) return;
  const found = await trx(table).where({ projectId }).whereIn('id', ids).pluck('id');
  if (found.length !== new Set(ids).size) throw invalid(field, 'Há registros que não pertencem a este projeto');
}

// Hierarquias (processo pai, por exemplo): o pai é do projeto e não forma ciclo (A → B → A)
export async function assertParent(trx, table, column, projectId, parentId, selfId, field = column) {
  if (parentId == null) return;
  if (parentId === selfId) throw invalid(field, 'Um registro não pode ser pai de si mesmo');
  await assertInProject(trx, table, projectId, parentId, field);
  let current = parentId;
  for (let i = 0; current && i < 100; i++) {
    const row = await trx(table).where({ id: current }).first(column);
    current = row?.[column];
    if (selfId && current === selfId) throw invalid(field, 'A hierarquia formaria um ciclo');
  }
}

// Listas de ids (jsonb) sem repetição, na ordem em que vieram
export const uniqueIds = (data, ...fields) => {
  const out = { ...data };
  for (const f of fields) if (Array.isArray(out[f])) out[f] = [...new Set(out[f])];
  return out;
};
