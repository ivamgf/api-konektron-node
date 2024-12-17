import { Request, Response } from 'express';
import { generateToken, validateUserCredentials } from './mockAuthService';

// Função de login usando mocks
export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await validateUserCredentials(email, password);

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const userId = user.id ?? -1;
    const token = generateToken(userId);

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
