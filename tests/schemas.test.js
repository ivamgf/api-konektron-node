import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema } from '#modules/auth/auth.schemas.js';
import { PHASE_CONTENT_SCHEMAS, modelSchema } from '#modules/crisp-dm/crispdm.schemas.js';
import { PHASE_KEYS } from '#modules/crisp-dm/crispdm.constants.js';

test('cadastro: senhas diferentes falham, e-mail é normalizado', () => {
  const base = { email: ' Ana@Teste.COM ', password: '12345678', acceptTerms: true };
  assert.equal(registerSchema.safeParse({ ...base, confirmPassword: 'x2345678' }).success, false);
  const ok = registerSchema.parse({ ...base, email: 'Ana@Teste.COM', confirmPassword: '12345678' });
  assert.equal(ok.email, 'ana@teste.com');
});

test('cadastro: termos de uso são obrigatórios', () => {
  const r = registerSchema.safeParse({
    email: 'a@b.com', password: '12345678', confirmPassword: '12345678', acceptTerms: false,
  });
  assert.equal(r.success, false);
});

test('CRISP-DM: existe schema de conteúdo para as 6 fases', () => {
  assert.equal(PHASE_KEYS.length, 6);
  for (const k of PHASE_KEYS) assert.ok(PHASE_CONTENT_SCHEMAS[k]);
});

test('CRISP-DM: decisão da avaliação aceita só valores válidos', () => {
  const s = PHASE_CONTENT_SCHEMAS.evaluation;
  assert.equal(s.safeParse({ decision: 'deploy' }).success, true);
  assert.equal(s.safeParse({ decision: 'talvez' }).success, false);
});

test('CRISP-DM: técnica de modelo validada', () => {
  assert.equal(modelSchema.safeParse({ name: 'rf', technique: 'classification' }).success, true);
  assert.equal(modelSchema.safeParse({ name: 'rf', technique: 'magia' }).success, false);
});

test('banco desatualizado (tabela ou coluna inexistente) responde 503 pedindo a migration', async () => {
  const { errorHandler } = await import('#middlewares/errorHandler.js');
  for (const code of ['42P01', '42703']) {
    let status;
    let body;
    const res = { status: (s) => ((status = s), res), json: (b) => (body = b) };
    errorHandler(Object.assign(new Error('x'), { code }), { log: { error() {} } }, res, () => {});
    assert.equal(status, 503, code);
    assert.match(body.error, /npm run migrate/);
  }
});
