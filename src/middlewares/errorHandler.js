import { z } from 'zod';
import { AppError } from '#utils/AppError.js';

const PG_ERRORS = {
  23505: [409, 'Registro já existe'],
  23503: [409, 'Registro relacionado não existe ou está em uso'],
  '22P02': [400, 'Formato de dado inválido'],
};

export function notFound(req, _res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

// Express identifica o handler de erro pelos 4 parâmetros: não remova `_next`
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details });
  }
  if (err instanceof z.ZodError) {
    return res.status(422).json({ error: 'Dados inválidos', details: z.flattenError(err).fieldErrors });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
  }
  if (PG_ERRORS[err.code]) {
    const [status, message] = PG_ERRORS[err.code];
    return res.status(status).json({ error: message });
  }
  req.log?.error({ err }, 'Erro não tratado');
  res.status(500).json({ error: 'Erro interno do servidor', requestId: req.id });
}
