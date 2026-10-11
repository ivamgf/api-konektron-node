export class AppError extends Error {
  constructor(message, statusCode = 400, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static notFound(what = 'Registro') {
    return new AppError(`${what} não encontrado`, 404);
  }
}
