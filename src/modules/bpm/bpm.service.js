import { db } from '#database/connection.js';
import { SIPOC_FIELDS } from './bpm.constants.js';
import { analyzeBpmn } from './bpmn.analyzer.js';

const countBy = (rows, key) => {
  const out = {};
  for (const r of rows) if (r[key]) out[r[key]] = (out[r[key]] ?? 0) + 1;
  return out;
};
const NOTATION_BY_EXT = { svg: 'image', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', pdf: 'pdf' };

export const bpmService = {
  // Visão geral: árvore de processos (o app monta a hierarquia), contagens e lacunas do SIPOC
  async overview(projectId) {
    const [processes, diagrams] = await Promise.all([
      db('bpm_processes')
        .where({ projectId })
        .orderBy('code')
        .select('id', 'code', 'name', 'parentId', 'level', 'status', 'owner', ...SIPOC_FIELDS),
      db('bpm_diagrams').where({ projectId }).select('id', 'processId', 'state', 'notation', 'fileName'),
    ]);
    const diagramsByProcess = countBy(diagrams, 'processId');
    return {
      processes: processes.map(({ suppliers, inputs, steps, outputs, customers, ...p }) => ({
        ...p,
        sipocComplete: [suppliers, inputs, steps, outputs, customers].every((v) => v?.trim()),
        diagrams: diagramsByProcess[p.id] ?? 0,
      })),
      counts: {
        processes: processes.length,
        byLevel: countBy(processes, 'level'),
        byStatus: countBy(processes, 'status'),
        diagrams: diagrams.length,
        diagramsByState: countBy(diagrams, 'state'),
        diagramsWithFile: diagrams.filter((d) => d.fileName).length,
      },
    };
  },

  // Ao receber o arquivo: métricas do BPMN (sempre recalculadas) e a notação, se vazia
  onUpload(buffer, { ext, row }) {
    const metrics = ['bpmn', 'xml'].includes(ext) ? analyzeBpmn(buffer) : null;
    const update = { metrics: metrics ? JSON.stringify(metrics) : null };
    if (!row.notation) update.notation = metrics?.isBpmn ? 'bpmn' : (NOTATION_BY_EXT[ext] ?? 'other');
    return { update, analysis: metrics };
  },
};
