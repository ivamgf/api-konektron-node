import { Request, Response } from 'express';
import { generateToken, validateUserCredentials } from '../services/authService';

// Função de login
export const login = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  // Verifica se o email e a senha foram fornecidos
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Valida as credenciais do usuário
    const user = await validateUserCredentials(email, password);

    // Caso o usuário não seja encontrado
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Usando o operador de coalescência nula para fornecer um valor padrão se user.id for undefined
    const userId = user.id ?? -1; // Fornece um valor padrão caso user.id seja undefined

    // Gera o token JWT com o userId
    const token = generateToken(userId);

    // Retorna uma resposta bem-sucedida com o token
    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    // Verifica se o erro é uma instância de Error para retornar a mensagem correta
    if (error instanceof Error) {
      return res.status(500).json({
        message: 'Internal Server Error',
        error: error.message,
      });
    }

    // Caso o erro não seja uma instância de Error, retornamos uma mensagem genérica
    return res.status(500).json({
      message: 'Internal Server Error',
      error: 'Unknown error',
    });
  }
};
