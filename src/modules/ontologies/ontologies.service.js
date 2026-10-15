import { db } from '#database/connection.js';
import { COUNT_FIELDS } from './ontologies.constants.js';
import { analyzeOntology } from './ontology.analyzer.js';

const tally = (rows, pick) => {
  const out = {};
  for (const row of rows) for (const key of [].concat(pick(row) ?? [])) out[key] = (out[key] ?? 0) + 1;
  return out;
};

export const ontologiesService = {
  async summary(projectId) {
    const rows = await db('ontologies')
      .where({ projectId })
      .select('format', 'status', 'vocabularies', 'principles', 'fileName', ...COUNT_FIELDS);
    const totals = Object.fromEntries(COUNT_FIELDS.map((f) => [f, rows.reduce((sum, r) => sum + (r[f] ?? 0), 0)]));
    return {
      total: rows.length,
      withFile: rows.filter((r) => r.fileName).length,
      published: rows.filter((r) => r.status === 'published').length,
      totals,
      byFormat: tally(rows, (r) => r.format),
      byStatus: tally(rows, (r) => r.status),
      vocabularies: tally(rows, (r) => r.vocabularies),
      principles: tally(rows, (r) => r.principles),
    };
  },

  // Ao receber o arquivo: guarda a análise e preenche só o que ainda está vazio
  // (contagens digitadas pelo usuário não são sobrescritas; o app oferece aplicar as sugestões)
  onUpload(buffer, { name, row }) {
    const analysis = analyzeOntology(buffer, name);
    const update = { analysis: JSON.stringify(analysis) };
    if (!row.format) update.format = analysis.format;
    if (!row.iri && analysis.iri && analysis.iri.length <= 1000) update.iri = analysis.iri;
    if (!row.version && analysis.version) update.version = analysis.version.slice(0, 50);
    for (const f of COUNT_FIELDS) if (row[f] == null && analysis.suggested) update[f] = analysis.suggested[f];
    const vocabularies = [...new Set([...(row.vocabularies ?? []), ...analysis.vocabularies])];
    if (vocabularies.length !== (row.vocabularies ?? []).length) update.vocabularies = JSON.stringify(vocabularies);
    return { update, analysis };
  },
};
