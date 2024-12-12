import { Request, Response } from 'express';
import { getProfileByUserId } from '../services/profileService';

/**
 * Controlador para consultar o perfil de um usuário.
 * Recebe o idUser como parâmetro na URL.
 */
export const getProfileController = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    // Chama o serviço para obter o perfil associado ao usuário
    const profile = await getProfileByUserId(Number(userId));

    // Verifica se o perfil foi encontrado
    if (profile) {
      res.status(200).json(profile);
    } else {
      res.status(404).json({ error: 'Perfil não encontrado para o usuário.' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar perfil.';
    res.status(500).json({ error: errorMessage });
  }
};
