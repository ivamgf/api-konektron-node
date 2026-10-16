import { db } from '#database/connection.js';
import { isMasterAdmin } from '#config/plans.js';
import { AppError } from '#utils/AppError.js';

const COLUMNS = ['id', 'email', 'role', 'plan', 'isActive', 'emailVerifiedAt', 'lastLoginAt', 'createdAt'];
const active = () => db('users').whereNull('deletedAt');
const revokeSessions = (userId) =>
  db('refresh_tokens').where({ userId }).whereNull('revokedAt').update({ revokedAt: db.fn.now() });

export const usersService = {
  // Soft delete: o registro fica para o histórico (audit_logs), mas os dados de login são
  // anonimizados para liberar o e-mail (único) para um novo cadastro.
  async softDelete(id) {
    const n = await active()
      .where({ id })
      .update({
        deletedAt: db.fn.now(),
        isActive: false,
        email: `${id}@deleted.invalid`,
        passwordHash: null,
        googleId: null,
      });
    if (n) await revokeSessions(id);
    return n;
  },

  async list({ page, pageSize, search, role, plan }) {
    const q = active();
    if (search) q.whereILike('email', `%${search}%`);
    if (role) q.where({ role });
    if (plan) q.where({ plan });

    const [{ count }] = await q.clone().count({ count: '*' });
    const data = await q
      .select(COLUMNS)
      .orderBy('createdAt', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    return { data, page, pageSize, total: Number(count) };
  },

  async get(id) {
    const user = await active().where({ id }).first(...COLUMNS);
    if (!user) throw AppError.notFound('Usuário');
    return user;
  },

  async update(id, data, actorId) {
    if (!Object.keys(data).length) throw new AppError('Nenhum campo para atualizar', 400);
    // o administrador não pode tirar o próprio acesso à administração (papel, plano Master ou conta ativa)
    if (id === actorId && (data.role || data.plan || data.isActive === false)) {
      throw new AppError('Você não pode alterar o próprio perfil ou desativar a própria conta', 400);
    }
    const before = await active().where({ id }).first('role', 'plan');
    if (!before) throw AppError.notFound('Usuário');
    const [user] = await active().where({ id }).update(data).returning(COLUMNS);
    if (!user) throw AppError.notFound('Usuário');
    // o perfil novo chega ao token na próxima renovação; quem perdeu a administração (ou foi desativado) sai na hora
    if (data.isActive === false || (isMasterAdmin(before) && !isMasterAdmin(user))) await revokeSessions(id);
    return user;
  },

  // RF5.2 - Excluir conta (a própria conta é excluída em DELETE /auth/me)
  async remove(id, actorId) {
    if (id === actorId) throw new AppError('Você não pode excluir a própria conta por aqui', 400);
    if (!(await this.softDelete(id))) throw AppError.notFound('Usuário');
  },
};
