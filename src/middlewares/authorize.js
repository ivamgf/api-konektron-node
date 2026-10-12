import { AppError } from '#utils/AppError.js';
import { canAccessSection } from '#config/plans.js';

export const requireRole =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role) ? next() : next(new AppError('Acesso negado', 403));

export const requireSection = (section) => (req, _res, next) =>
  canAccessSection(req.user, section)
    ? next()
    : next(new AppError('Seu plano não inclui esta seção', 403, { section }));
