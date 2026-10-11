import { AppError } from '#utils/AppError.js';
import { verifyAccessToken } from '#utils/tokens.js';

export function authenticate(req, _res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return next(new AppError('Token não informado', 401));
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, plan: payload.plan };
    next();
  } catch {
    next(new AppError('Token inválido ou expirado', 401));
  }
}
