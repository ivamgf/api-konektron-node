// __mocks__/mockDeleteUserController.ts
import { Request, Response } from 'express';
import data from './mockData.json';  // Importando dados mockados de usuários

// Controlador de deletação de usuário
export const deleteUserController = (req: Request, res: Response) => {
  const { userId } = req.params;

  // Verifica se o userId foi fornecido
  if (!userId) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  // Converte o userId para número (no JSON ele é numérico)
  const userIdNumber = Number(userId);

  // Simula o comportamento de buscar o usuário
  const userIndex = data.users.findIndex(user => user.id === userIdNumber);

  if (userIndex === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Simula a exclusão do usuário
  data.users.splice(userIndex, 1);

  return res.status(200).json({ message: 'User deleted successfully' });
};
