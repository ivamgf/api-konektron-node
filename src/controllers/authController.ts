import { Request, Response } from 'express';
import { generateToken, validateUserCredentials } from '../services/authService';

export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  try {
    const user = await validateUserCredentials(email, password);

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user.id);
    return res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    // Checa se 'error' é uma instância de Error
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
    // Caso contrário, retorna uma mensagem genérica
    return res.status(500).json({ message: 'Internal Server Error', error: 'Unknown error' });
  }
};
