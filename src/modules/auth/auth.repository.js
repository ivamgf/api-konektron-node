import { db } from '#database/connection.js';

export const authRepository = {
  findUserByEmail: (email) => db('users').where({ email }).whereNull('deletedAt').first(),
  findUserById: (id) => db('users').where({ id }).whereNull('deletedAt').first(),

  createUserWithProfile: (data) =>
    db.transaction(async (trx) => {
      const [user] = await trx('users').insert(data).returning('*');
      await trx('profiles').insert({ userId: user.id });
      return user;
    }),

  updateUser: (id, data) => db('users').where({ id }).update(data),

  // Refresh tokens
  saveRefreshToken: (data) => db('refresh_tokens').insert(data),
  findRefreshToken: (tokenHash) => db('refresh_tokens').where({ tokenHash }).first(),
  revokeRefreshToken: (tokenHash) =>
    db('refresh_tokens').where({ tokenHash }).whereNull('revokedAt').update({ revokedAt: db.fn.now() }),
  revokeAllRefreshTokens: (userId) =>
    db('refresh_tokens').where({ userId }).whereNull('revokedAt').update({ revokedAt: db.fn.now() }),

  // Tokens de e-mail (ativação / reset)
  invalidateUserTokens: (userId, type) =>
    db('user_tokens').where({ userId, type }).whereNull('usedAt').update({ usedAt: db.fn.now() }),
  saveUserToken: (data) => db('user_tokens').insert(data),
  findValidUserToken: (tokenHash, type) =>
    db('user_tokens')
      .where({ tokenHash, type })
      .whereNull('usedAt')
      .where('expiresAt', '>', db.fn.now())
      .first(),
  markUserTokenUsed: (id) => db('user_tokens').where({ id }).update({ usedAt: db.fn.now() }),
};
