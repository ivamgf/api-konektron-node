import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DATASET_IMPORT_MAX, datasetImportSchema } from '#modules/crisp-dm/crispdm.schemas.js';
import { crispdmService } from '#modules/crisp-dm/crispdm.service.js';

test('importação de datasets: lista de 1 até o máximo', () => {
  assert.equal(datasetImportSchema.safeParse({ datasets: [{ name: 'a' }] }).success, true);
  assert.equal(datasetImportSchema.safeParse({ datasets: [] }).success, false);
  assert.equal(datasetImportSchema.safeParse({ datasets: Array(DATASET_IMPORT_MAX + 1).fill({ name: 'a' }) }).success, false);
  assert.equal(datasetImportSchema.safeParse({ datasets: 'x' }).success, false);
});

test('importação de datasets: linhas inválidas voltam com o número da linha, antes de tocar no banco', async () => {
  await assert.rejects(
    crispdmService.importDatasets('p1', [
      { name: 'clientes', rowCount: 10 },
      { name: '', rowCount: 5 },
      { name: 'vendas', rowCount: -1, collectedAt: '31/01/2026' },
    ]),
    (err) => {
      assert.equal(err.statusCode, 422);
      assert.deepEqual(err.details.rows.map((r) => r.row), [2, 3]);
      assert.ok(err.details.rows[0].errors.name);
      assert.deepEqual(Object.keys(err.details.rows[1].errors).sort(), ['collectedAt', 'rowCount']);
      return true;
    },
  );
});
