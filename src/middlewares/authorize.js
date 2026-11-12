import { AppError } from '#utils/AppError.js';
import { canAccessSection, isMasterAdmin, plansWithSection } from '#config/plans.js';
import { db } from '#database/connection.js';

// Perfil atual do usuário, lido no banco (o token pode estar com o plano antigo por até 15 minutos:
// assinar, cancelar ou voltar ao Free vale na hora). Fica em req.account durante a requisição.
export async function currentAccount(req) {
  if (req.account) return req.account;
  const account = await db('users')
    .where({ id: req.user.id, isActive: true })
    .whereNull('deletedAt')
    .first('id', 'email', 'role', 'plan', 'projectsCreated');
  if (!account) throw new AppError('Conta inativa ou excluída', 401);
  req.account = account;
  return account;
}

// Área administrativa: confere no banco (não só no token), para que um rebaixamento valha na hora
export async function requireMasterAdmin(req, _res, next) {
  if (!isMasterAdmin(req.user)) return next(new AppError('Acesso negado', 403));
  const user = await db('users')
    .where({ id: req.user.id, isActive: true })
    .whereNull('deletedAt')
    .first('role', 'plan');
  return isMasterAdmin(user) ? next() : next(new AppError('Acesso negado', 403));
}

export const planError = (section, reason = 'plan') =>
  new AppError(
    reason === 'owner'
      ? 'O plano do dono deste projeto não inclui esta seção'
      : 'Seu plano não inclui esta seção',
    403,
    { section, reason, plans: plansWithSection(section) },
  );

// Seção exigida pela rota: precisa estar no plano do usuário. Marca req.section para o loadProject,
// que confere também o plano do dono quando o projeto é compartilhado.
export const requireSection = (section) => async (req, _res, next) => {
  const account = await currentAccount(req);
  if (!canAccessSection(account, section)) return next(planError(section));
  req.section = section;
  next();
};
