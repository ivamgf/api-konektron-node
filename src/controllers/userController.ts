// userController.ts
import { Request, Response } from 'express';
import { createUser, enableUser, updateUserPassword } from '../services/userService';

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, type } = req.body;

  try {
    const user = await createUser(email, password, type);
    res.status(201).json({ message: 'Usuário criado. Verifique seu e-mail para confirmar.', userId: user.id });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário.';
    res.status(500).json({ error: errorMessage });
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
    const errorMessage = error instanceof Error ? error.message : 'Erro ao confirmar usuário.';
    res.status(500).json({ error: errorMessage });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await updateUserPassword(Number(userId), newPassword);
    res.status(200).json({ message: 'Senha atualizada com sucesso.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar senha.';
    res.status(500).json({ error: errorMessage });
  }
};
