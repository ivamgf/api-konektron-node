import { db } from '#database/connection.js';
import { AppError } from '#utils/AppError.js';
import * as R from './fp.rules.js';

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

export const fpService = {
  // Complexidade e PF são gravados com a função (somas e filtros direto no banco).
  // No PATCH parcial, completa com os valores atuais antes de recalcular.
  async evaluateWrite(trx, countId, data, id) {
    const current = id ? await trx('fp_functions').where({ id, countId }).first('type', 'det', 'retFtr') : {};
    if (id && !current) return; // o crudRouter responde 404
    const merged = { ...current, ...data };
    Object.assign(data, R.evaluate(merged));
  },

  // Resumo de uma contagem: as tabelas das planilhas (escopo, complexidade, contribuição) e o total
  summarize(count, functions) {
    const byType = Object.fromEntries(R.FUNCTION_TYPES.map((t) => [t, { low: 0, average: 0, high: 0, functions: 0, points: 0 }]));
    const byAction = Object.fromEntries(R.ACTIONS.map((a) => [a, 0]));
    let det = 0;
    let ret = 0;
    for (const f of functions) {
      const row = byType[f.type];
      row[f.complexity] += 1;
      row.functions += 1;
      row.points += f.points;
      if (f.action) byAction[f.action] += f.points;
      if (R.DATA_TYPES.includes(f.type)) {
        det += f.det;
        ret += f.retFtr;
      }
    }
    const dataPoints = byType.ilf.points + byType.eif.points;
    const total = Object.values(byType).reduce((n, r) => n + r.points, 0);
    const effortHours = count.hoursPerFp == null ? null : round(total * count.hoursPerFp);
    return {
      // Determinação do escopo: quantas funções de dados
      scope: { ilf: byType.ilf.functions, eif: byType.eif.functions, total: byType.ilf.functions + byType.eif.functions },
      // Tabela de complexidade: totais de TD e TR das funções de dados
      complexity: { det, ret, total: det + ret },
      // Tabela de contribuição, por tipo e complexidade
      contribution: byType,
      dataPoints,
      transactionPoints: total - dataPoints,
      totalPoints: total,
      byAction: count.countType === 'enhancement' ? byAction : null,
      estimate: {
        effortHours,
        cost: effortHours == null || count.costPerHour == null ? null : round(effortHours * count.costPerHour),
        currency: count.currency,
      },
    };
  },

  async summary(projectId, countId) {
    const count = await db('fp_counts').where({ id: countId, projectId }).first();
    if (!count) throw AppError.notFound('Contagem');
    const functions = await db('fp_functions').where({ countId }).orderBy([{ column: 'type' }, { column: 'name' }]);
    return { count, functions, summary: this.summarize(count, functions) };
  },

  // Lista de contagens com o total de PF de cada uma
  async overview(projectId) {
    const [counts, totals] = await Promise.all([
      db('fp_counts').where({ projectId }).orderBy('createdAt', 'desc'),
      db('fp_functions')
        .join('fp_counts', 'fp_counts.id', 'fp_functions.count_id')
        .where('fp_counts.project_id', projectId)
        .groupBy('fp_functions.count_id')
        .select('fp_functions.count_id as countId')
        .sum({ points: 'fp_functions.points' })
        .count({ functions: '*' }),
    ]);
    const byCount = Object.fromEntries(totals.map((t) => [t.countId, t]));
    return counts.map((c) => ({
      ...c,
      functions: Number(byCount[c.id]?.functions ?? 0),
      totalPoints: Number(byCount[c.id]?.points ?? 0),
    }));
  },
};
