import { Request, Response } from 'express';
import { createUser, enableUser } from '../services/userService';

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, type } = req.body;

  try {
    const user = await createUser(email, password, type);
    res.status(201).json({ message: 'Usuário criado. Verifique seu e-mail para confirmar.', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

export const confirmUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const user = await enableUser(Number(userId));
    if (user) {
      res.status(200).json({ message: 'Usuário confirmado com sucesso.' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao confirmar usuário.' });
  }
};
