import { AppError } from '#utils/AppError.js';
import { canAccessSection, isMasterAdmin } from '#config/plans.js';
import { db } from '#database/connection.js';

// Área administrativa: confere no banco (não só no token), para que um rebaixamento valha na hora
export async function requireMasterAdmin(req, _res, next) {
  if (!isMasterAdmin(req.user)) return next(new AppError('Acesso negado', 403));
  const user = await db('users')
    .where({ id: req.user.id, isActive: true })
    .whereNull('deletedAt')
    .first('role', 'plan');
  return isMasterAdmin(user) ? next() : next(new AppError('Acesso negado', 403));
}

export const requireSection = (section) => (req, _res, next) =>
  canAccessSection(req.user, section)
    ? next()
    : next(new AppError('Seção não encontrada', 404, { section }));
