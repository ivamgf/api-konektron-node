import { afterEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';

// Antes de importar a configuração: liga o login com Google neste processo de teste
process.env.GOOGLE_CLIENT_ID = '1234-teste.apps.googleusercontent.com';

const { OAuth2Client } = await import('google-auth-library');
const { authService } = await import('#modules/auth/auth.service.js');
const { authRepository: repo } = await import('#modules/auth/auth.repository.js');
const { changePasswordSchema, deleteAccountSchema, googleSchema } =
  await import('#modules/auth/auth.schemas.js');
const { buildOpenApi } = await import('../src/docs/openapi.js');

const credential = 'x'.repeat(200);
const GOOGLE_ID = '109876543210';
const baseUser = {
  id: '0b0f6d0e-3c1a-4f6e-9d55-1f2a3b4c5d6e',
  email: 'ana@exemplo.com',
  role: 'client',
  plan: 'free',
  isActive: true,
  emailVerifiedAt: null,
  passwordHash: 'hash',
  googleId: null,
};

// Simula o Google (ID token válido com estes dados) e o banco
function setup({ payload = {}, byGoogleId = null, byEmail = null, verifyError } = {}) {
  mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => {
    if (verifyError) throw verifyError;
    return {
      getPayload: () => ({
        sub: GOOGLE_ID,
        email: 'Ana@Exemplo.com',
        email_verified: true,
        ...payload,
      }),
    };
  });
  const calls = { updateUser: [], create: [] };
  mock.method(repo, 'findUserByGoogleId', async () => byGoogleId);
  mock.method(repo, 'findUserByEmail', async (email) =>
    byEmail && email === byEmail.email ? byEmail : null,
  );
  mock.method(repo, 'updateUser', async (id, data) => calls.updateUser.push({ id, data }));
  mock.method(repo, 'createUserWithProfile', async (data) => {
    calls.create.push(data);
    return { ...baseUser, ...data, id: 'novo-id', role: 'client', plan: 'free', isActive: true };
  });
  mock.method(repo, 'saveRefreshToken', async () => {});
  return calls;
}

afterEach(() => mock.restoreAll());

test('Google: conta já vinculada entra direto', async () => {
  const calls = setup({ byGoogleId: { ...baseUser, googleId: GOOGLE_ID } });
  const r = await authService.googleLogin({ credential });
  assert.equal(r.created, false);
  assert.equal(r.user.email, 'ana@exemplo.com');
  assert.equal(r.user.googleLinked, true);
  assert.ok(r.accessToken && r.refreshToken);
  assert.equal(calls.create.length, 0);
});

test('Google: conta com o mesmo e-mail é vinculada e o e-mail fica verificado', async () => {
  const calls = setup({ byEmail: baseUser });
  const r = await authService.googleLogin({ credential });
  assert.equal(r.created, false);
  assert.equal(r.user.hasPassword, true); // a senha antiga continua valendo
  assert.equal(calls.updateUser[0].data.googleId, GOOGLE_ID);
  assert.ok(calls.updateUser[0].data.emailVerifiedAt instanceof Date);
});

test('Google: e-mail já vinculado a outra conta Google é recusado', async () => {
  setup({ byEmail: { ...baseUser, googleId: 'outro-id' } });
  await assert.rejects(authService.googleLogin({ credential }), { statusCode: 409 });
});

test('Google: conta nova exige o aceite dos Termos de Uso', async () => {
  const calls = setup();
  await assert.rejects(authService.googleLogin({ credential }), (err) => {
    assert.equal(err.statusCode, 422);
    assert.ok(err.details.acceptTerms);
    return true;
  });
  assert.equal(calls.create.length, 0);
});

test('Google: conta nova é criada sem senha, com e-mail verificado', async () => {
  const calls = setup();
  const r = await authService.googleLogin({ credential, acceptTerms: true });
  assert.equal(r.created, true);
  assert.equal(calls.create[0].email, 'ana@exemplo.com');
  assert.equal(calls.create[0].googleId, GOOGLE_ID);
  assert.equal(calls.create[0].passwordHash, null);
  assert.ok(calls.create[0].emailVerifiedAt instanceof Date);
  assert.equal(r.user.hasPassword, false);
});

test('Google: conta desativada não entra (nem é vinculada)', async () => {
  const calls = setup({ byEmail: { ...baseUser, isActive: false } });
  await assert.rejects(authService.googleLogin({ credential }), { statusCode: 401 });
  assert.equal(calls.updateUser.length, 0);
});

test('Google: token inválido ou e-mail não verificado pelo Google são recusados', async () => {
  setup({ verifyError: new Error('Wrong recipient') });
  await assert.rejects(authService.googleLogin({ credential }), { statusCode: 401 });
  mock.restoreAll();
  setup({ payload: { email_verified: false } });
  await assert.rejects(authService.googleLogin({ credential }), { statusCode: 401 });
});

test('Google: schemas de login, troca de senha e exclusão de conta', () => {
  assert.equal(googleSchema.safeParse({ credential: 'curta' }).success, false);
  assert.equal(googleSchema.safeParse({ credential, acceptTerms: true }).success, true);
  // conta só Google define a primeira senha sem a atual
  assert.equal(
    changePasswordSchema.safeParse({ password: 'nova12345', confirmPassword: 'nova12345' }).success,
    true,
  );
  // exclusão: senha ou e-mail de confirmação
  assert.equal(deleteAccountSchema.safeParse({}).success, false);
  assert.equal(deleteAccountSchema.safeParse({ password: 'x' }).success, true);
  assert.equal(
    deleteAccountSchema.parse({ confirmEmail: 'Ana@Exemplo.com' }).confirmEmail,
    'ana@exemplo.com',
  );
});

test('Google: rota documentada no OpenAPI', () => {
  const doc = buildOpenApi();
  assert.ok(doc.paths['/auth/google']?.post);
  assert.ok(doc.components.schemas.User.required.includes('hasPassword'));
});
