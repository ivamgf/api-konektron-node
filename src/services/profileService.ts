import { Profile } from '../models/profileModel';
import { User } from '../models/userModel';
import UsersHaveProfile from '../models/usersHaveProfileModel';

/**
 * Função para obter o perfil de um usuário pelo idUser.
 * Verifica a associação entre o usuário e o perfil.
 */
export const getProfileByUserId = async (idUser: number): Promise<Profile | null> => {
  // Busca o perfil associado ao usuário através da tabela UsersHaveProfile
  const profile = await Profile.findOne({
    // Join com a tabela UsersHaveProfile para verificar o perfil do usuário
    include: {
      model: User,
      through: {
        attributes: [] // Não precisa de atributos específicos da tabela de junção
      },
      where: {
        idUser: idUser,
      },
    },
  });

  return profile; // Retorna o perfil ou null se não encontrar
};
