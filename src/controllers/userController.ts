import { Request, Response } from 'express';
import { createUser, enableUser, updateUserPassword, getUsers, deleteUser } from '../services/userService';
import { Profile } from '../models/profileModel';

export const registerUser = async (req: Request, res: Response) => {
  const { email, password, type } = req.body;

  try {
    // Verifica se todos os parâmetros necessários foram fornecidos
    if (!email || !password || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando: email, password, type' });
    }

    // Aqui, criamos o usuário com o campo "enabled" já como true
    const user = await createUser(email, password, type); // Passando "true" para o campo enabled
    res.status(201).json({ message: 'Usuário criado com sucesso.', userId: user.idUser });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar usuário.';
    res.status(500).json({ error: errorMessage });
  }
};

export const confirmUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Verifica se o userId é válido
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ error: 'ID de usuário inválido.' });
    }

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
    // Verifica se o userId e a senha estão presentes
    if (!userId || isNaN(Number(userId)) || !newPassword) {
      return res.status(400).json({ error: 'ID de usuário ou nova senha ausente.' });
    }

    const user = await updateUserPassword(Number(userId), newPassword);
    if (user) {
      res.status(200).json({ message: 'Senha atualizada com sucesso.' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado.' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar senha.';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Controlador para consultar usuários.
 * Pode retornar todos os usuários ou um específico dependendo do parâmetro `userId`.
 */
export const queryUsers = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    if (userId) {
      // Verifica se o userId é válido
      if (isNaN(Number(userId))) {
        return res.status(400).json({ error: 'ID de usuário inválido.' });
      }
      const user = await getUsers(Number(userId));
      if (user) {
        res.status(200).json(user);
      } else {
        res.status(404).json({ error: 'Usuário não encontrado.' });
      }
    } else {
      const users = await getUsers();
      res.status(200).json(users);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar usuário(s).';
    res.status(500).json({ error: errorMessage });
  }
};

/**
 * Controlador para deletar um usuário e suas associações com idUserHaveProfile e idProfile.
 */
export const deleteUserController = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Verifica se o userId é válido
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({ error: 'ID de usuário inválido.' });
    }

    // Deleta as associações com idUserHaveProfile e idProfile antes de deletar o usuário
    await Profile.destroy({
      where: { userId: Number(userId) },
    });

    // Deleta o usuário
    const user = await deleteUser(Number(userId));
    if (user) {
      res.status(200).json({ message: 'Usuário e suas associações deletados com sucesso.' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado.' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar usuário.';
    res.status(500).json({ error: errorMessage });
  }
};
