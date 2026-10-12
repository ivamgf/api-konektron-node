// Conversão automática snake_case (banco) <-> camelCase (código/API)
export const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const toSnake = (s) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const isPlainObject = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v);

// Raso de propósito: o conteúdo de colunas jsonb não é alterado
export const camelizeKeys = (row) =>
  isPlainObject(row) ? Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v])) : row;

export function postProcessResponse(result) {
  if (Array.isArray(result)) return result.map(camelizeKeys);
  if (Array.isArray(result?.rows)) return { ...result, rows: result.rows.map(camelizeKeys) }; // db.raw
  return camelizeKeys(result);
}

export const wrapIdentifier = (value, origImpl) => origImpl(value === '*' ? value : toSnake(value));
