// Regras de contagem de Pontos de Função (IFPUG / CPM 4.3).
// Funções de dados (planilhas "Complexidade" e "Contribuição"): ALI (ilf) e AIE (eif), complexidade
// pela matriz TR × TD. Funções de transação (EE = ei, SE = eo, CE = eq) seguem as tabelas do mesmo manual.
export const COUNT_TYPES = ['development', 'enhancement', 'application'];
export const FUNCTION_TYPES = ['ilf', 'eif', 'ei', 'eo', 'eq'];
export const DATA_TYPES = ['ilf', 'eif'];
export const ACTIONS = ['add', 'change', 'delete']; // projeto de melhoria
export const COMPLEXITIES = ['low', 'average', 'high'];

// Tabela de contribuição: PF por tipo e complexidade
export const WEIGHTS = {
  ilf: { low: 7, average: 10, high: 15 },
  eif: { low: 5, average: 7, high: 10 },
  ei: { low: 3, average: 4, high: 6 },
  eo: { low: 4, average: 5, high: 7 },
  eq: { low: 3, average: 4, high: 6 },
};

// Faixas de cada tabela: [limite da 1ª faixa, limite da 2ª faixa] (acima disso, 3ª faixa)
// linhas = TR (dados) ou ALR/FTR (transações); colunas = TD
export const BANDS = {
  ilf: { rows: [1, 5], cols: [19, 50] }, // TR: 1 | 2-5 | >5 · TD: <20 | 20-50 | >50
  eif: { rows: [1, 5], cols: [19, 50] },
  ei: { rows: [1, 2], cols: [4, 15] }, // ALR: 0-1 | 2 | >2 · TD: 1-4 | 5-15 | >15
  eo: { rows: [1, 3], cols: [5, 19] }, // ALR: 0-1 | 2-3 | >3 · TD: 1-5 | 6-19 | >19
  eq: { rows: [1, 3], cols: [5, 19] },
};

// A mesma matriz para todos os tipos
const MATRIX = [
  ['low', 'low', 'average'],
  ['low', 'average', 'high'],
  ['average', 'high', 'high'],
];

const band = (value, [a, b]) => (value <= a ? 0 : value <= b ? 1 : 2);

export function complexity(type, det, retFtr) {
  const { rows, cols } = BANDS[type];
  return MATRIX[band(retFtr, rows)][band(det, cols)];
}

export const points = (type, cx) => WEIGHTS[type][cx];

// Calcula complexidade e PF de uma função (det = TD; retFtr = TR para dados, ALR para transações)
export function evaluate({ type, det, retFtr }) {
  const cx = complexity(type, det, retFtr);
  return { complexity: cx, points: points(type, cx) };
}
