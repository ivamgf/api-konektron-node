import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOpenApi } from '../src/docs/openapi.js';

const doc = buildOpenApi();
const operations = Object.entries(doc.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, op]) => ({ path, method, op })),
);

test('documento OpenAPI 3.1 com versão do package.json', () => {
  assert.equal(doc.openapi, '3.1.0');
  assert.match(doc.info.version, /^\d+\.\d+\.\d+$/);
  assert.ok(operations.length >= 80, `só ${operations.length} operações`);
});

test('todo $ref aponta para um componente existente', () => {
  const refs = JSON.stringify(doc).match(/"\$ref":"[^"]+"/g) ?? [];
  for (const raw of new Set(refs)) {
    const [, , section, name] = raw.slice(8, -1).split('/'); // #/components/<section>/<name>
    assert.ok(doc.components[section]?.[name], `${raw} não existe`);
  }
});

test('parâmetros de rota declarados e operações completas', () => {
  for (const { path, method, op } of operations) {
    const where = `${method.toUpperCase()} ${path}`;
    const declared = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name);
    const inPath = [...path.matchAll(/\{(\w+)\}/g)].map(([, n]) => n);
    assert.deepEqual(declared, inPath, `${where}: parâmetros de rota`);
    assert.ok(op.tags?.length && op.summary, `${where}: tag/summary`);
    assert.ok(Object.keys(op.responses).some((c) => c < 300), `${where}: resposta de sucesso`);
    if (op.security.length) assert.ok(op.responses[401], `${where}: rota protegida sem 401`);
  }
});

test('corpos refletem os schemas de validação', () => {
  const body = (path, method) =>
    doc.paths[path][method].requestBody.content['application/json'].schema;
  const register = body('/auth/register', 'post');
  assert.deepEqual(register.required.sort(), ['acceptTerms', 'confirmPassword', 'email', 'password']);
  assert.equal(register.properties.password.minLength, 8);
  // PATCH é parcial: nada obrigatório
  assert.equal(body('/projects/{projectId}/system-analysis/requirements/{id}', 'patch').required, undefined);
});
