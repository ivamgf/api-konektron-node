import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { JWT_SECRET } from '../config'; // Certifique-se de que a configuração está correta

// Extende a interface Request para incluir o campo `user`
declare global {
  namespace Express {
    interface Request {
      user?: string | JwtPayload;
    }
  }
}

// Middleware para autenticar o token JWT
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET); // Garante que `JWT_SECRET` é constante e seguro
    req.user = payload; // Armazena o payload no objeto `req` para uso posterior
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token.' });
  }
};
