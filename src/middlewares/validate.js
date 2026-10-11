import { z } from 'zod';
import { AppError } from '#utils/AppError.js';

// Uso: validate({ body, params, query }). Resultado em req.validated.
// (Express 5 torna req.query somente-leitura, por isso não sobrescrevemos req.*)
export const validate = (schemas) => (req, _res, next) => {
  req.validated ??= {};
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      return next(new AppError('Dados inválidos', 422, z.flattenError(result.error).fieldErrors));
    }
    req.validated[key] = result.data;
  }
  next();
};
