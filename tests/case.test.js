import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCamel, toSnake, postProcessResponse } from '#utils/case.js';

test('converte snake_case <-> camelCase', () => {
  assert.equal(toCamel('email_verified_at'), 'emailVerifiedAt');
  assert.equal(toSnake('emailVerifiedAt'), 'email_verified_at');
  assert.equal(toSnake('already_snake'), 'already_snake');
});

test('postProcessResponse é raso (não altera jsonb)', () => {
  const [row] = postProcessResponse([{ step_order: 1, content: { some_key: 'x' } }]);
  assert.deepEqual(row, { stepOrder: 1, content: { some_key: 'x' } });
});

test('postProcessResponse preserva Date e valores escalares', () => {
  const d = new Date();
  assert.deepEqual(postProcessResponse({ created_at: d }), { createdAt: d });
  assert.equal(postProcessResponse(3), 3);
});
