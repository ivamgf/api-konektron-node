import { Request, Response } from 'express';
import mockData from './mockData.json';

export const mockGetProfileController = async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Simula busca de perfil no mockData
  const profile = mockData.profiles.find((p) => p.userId === Number(userId));

  if (profile) {
    res.status(200).json(profile);
  } else {
    res.status(404).json({ error: 'Perfil não encontrado para o usuário.' });
  }
};

export const mockUpdateProfileController = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const updatedData = req.body;

  // Simula atualização de perfil no mockData
  const profileIndex = mockData.profiles.findIndex((p) => p.userId === Number(userId));

  if (profileIndex !== -1) {
    const updatedProfile = { ...mockData.profiles[profileIndex], ...updatedData };
    mockData.profiles[profileIndex] = updatedProfile;
    res.status(200).json({ message: 'Perfil atualizado com sucesso.', updatedProfile });
  } else {
    res.status(404).json({ error: 'Perfil não encontrado para o usuário.' });
  }
};
