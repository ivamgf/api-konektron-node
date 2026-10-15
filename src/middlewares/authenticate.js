import { AppError } from '#utils/AppError.js';
import { verifyAccessToken } from '#utils/tokens.js';

// Rotas públicas que aproveitam o usuário quando há token válido (ex.: contato)
export function optionalAuth(req, _res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role, plan: payload.plan };
    } catch {
      // token inválido numa rota pública: segue como visitante
    }
  }
  next();
}

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
