import bcrypt from 'bcryptjs';
import { env } from '#config/env.js';
import { AppError } from '#utils/AppError.js';
import { logger } from '#utils/logger.js';
import { generateOpaqueToken, hashToken, signAccessToken } from '#utils/tokens.js';
import { sendMail, mailTemplates } from '#services/mailer.js';
import { usersService } from '#modules/users/users.service.js';
import { authRepository as repo } from './auth.repository.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BCRYPT_COST = 12;

// Hash fixo para comparar quando o e-mail não existe (evita timing attack de enumeração)
const DUMMY_HASH = bcrypt.hashSync('konektron-dummy-password', BCRYPT_COST);

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  role: u.role,
  plan: u.plan,
  emailVerified: Boolean(u.emailVerifiedAt),
});

async function issueTokens(user) {
  const refreshToken = generateOpaqueToken();
  await repo.saveRefreshToken({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_EXPIRES_DAYS * DAY),
  });
  return { accessToken: signAccessToken(user), refreshToken };
}

async function createEmailToken(userId, type, ttlMs) {
  await repo.invalidateUserTokens(userId, type); // só o link mais recente vale
  const token = generateOpaqueToken();
  await repo.saveUserToken({
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

// Falha de SMTP não deve desfazer a operação; o usuário pode pedir o reenvio.
async function sendMailSafely(message) {
  try {
    await sendMail(message);
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, 'Falha ao enviar e-mail');
  }
}

async function sendActivationEmail(user) {
  const token = await createEmailToken(user.id, 'email_verification', 48 * HOUR);
  await sendMailSafely({
    to: user.email,
    ...mailTemplates.activation(`${env.APP_URL}/verify-email?token=${token}`),
  });
}

async function findActiveUser(userId) {
  const user = await repo.findUserById(userId);
  if (!user?.isActive) throw AppError.notFound('Usuário');
  return user;
}

// Contas só Google não têm senha local
async function assertPassword(user, password) {
  if (!user.passwordHash) throw new AppError('Esta conta não possui senha local', 400);
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Senha atual incorreta', 401);
  }
}

export const authService = {
  // RF1 - Cadastrar usuário
  async register({ email, password }) {
    if (await repo.findUserByEmail(email)) throw new AppError('E-mail já cadastrado', 409);

    const user = await repo.createUserWithProfile({
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      termsAccepted: true,
    });
    await sendActivationEmail(user);

    // UC001 pós-condição 3: logar automaticamente
    return { user: publicUser(user), ...(await issueTokens(user)) };
  },

  async resendVerification(userId) {
    const user = await findActiveUser(userId);
    if (!user.emailVerifiedAt) await sendActivationEmail(user);
  },

  async verifyEmail(token) {
    const record = await repo.findValidUserToken(hashToken(token), 'email_verification');
    if (!record) throw new AppError('Link inválido ou expirado', 400);
    await repo.updateUser(record.userId, { emailVerifiedAt: new Date() });
    await repo.markUserTokenUsed(record.id);
  },

  // RF2 - Autenticar usuário
  async login({ email, password }) {
    const user = await repo.findUserByEmail(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok || !user.isActive) throw new AppError('E-mail ou senha incorretos', 401);

    await repo.updateUser(user.id, { lastLoginAt: new Date() });
    return { user: publicUser(user), ...(await issueTokens(user)) };
  },

  // Rotação de refresh token com detecção de reuso
  async refresh(refreshToken) {
    const hash = hashToken(refreshToken);
    const record = await repo.findRefreshToken(hash);
    if (!record) throw new AppError('Sessão expirada', 401);

    if (record.revokedAt) {
      // Token já usado: possível roubo. Derruba todas as sessões do usuário.
      await repo.revokeAllRefreshTokens(record.userId);
      logger.warn({ userId: record.userId }, 'Reuso de refresh token detectado');
      throw new AppError('Sessão inválida, faça login novamente', 401);
    }
    if (record.expiresAt < new Date()) throw new AppError('Sessão expirada', 401);

    const user = await repo.findUserById(record.userId);
    if (!user?.isActive) throw new AppError('Sessão expirada', 401);

    await repo.revokeRefreshToken(hash);
    return issueTokens(user);
  },

  // RF7 - Deslogar
  async logout(userId, refreshToken, { allDevices = false } = {}) {
    if (allDevices) return repo.revokeAllRefreshTokens(userId);
    if (refreshToken) await repo.revokeRefreshToken(hashToken(refreshToken));
  },

  // RF4 - Recuperar senha (resposta sempre igual, para não revelar e-mails cadastrados)
  async forgotPassword(email) {
    const user = await repo.findUserByEmail(email);
    if (!user?.isActive) return;
    const token = await createEmailToken(user.id, 'password_reset', HOUR);
    await sendMailSafely({
      to: email,
      ...mailTemplates.resetPassword(`${env.APP_URL}/reset-password?token=${token}`),
    });
  },

  async resetPassword({ token, password }) {
    const record = await repo.findValidUserToken(hashToken(token), 'password_reset');
    if (!record) throw new AppError('Link inválido ou expirado', 400);
    await repo.updateUser(record.userId, { passwordHash: await bcrypt.hash(password, BCRYPT_COST) });
    await repo.markUserTokenUsed(record.id);
    await repo.revokeAllRefreshTokens(record.userId);
    return record.userId;
  },

  async me(userId) {
    const user = await repo.findUserById(userId);
    if (!user) throw AppError.notFound('Usuário');
    return publicUser(user);
  },

  // Troca de senha logado: derruba as outras sessões e devolve tokens novos para esta
  async changePassword(userId, { currentPassword, password }) {
    const user = await findActiveUser(userId);
    await assertPassword(user, currentPassword);
    await repo.updateUser(userId, { passwordHash: await bcrypt.hash(password, BCRYPT_COST) });
    await repo.revokeAllRefreshTokens(userId);
    return issueTokens(user);
  },

  // Exclusão da própria conta (confirmada com a senha)
  async deleteAccount(userId, password) {
    const user = await findActiveUser(userId);
    await assertPassword(user, password);
    await usersService.softDelete(userId);
  },
};
