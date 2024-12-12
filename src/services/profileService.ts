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

/**
 * Função para atualizar o perfil de um usuário pelo idUser.
 * Atualiza as informações do perfil relacionado ao usuário.
 */
export const updateProfileByUserId = async (idUser: number, updatedData: any): Promise<Profile | null> => {
    // Encontrar o perfil associado ao idUser
    const profile = await Profile.findOne({
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
  
    // Se o perfil não for encontrado, retorna null
    if (!profile) {
      return null;
    }
  
    // Atualizar os campos do perfil com os dados recebidos
    await profile.update(updatedData);
  
    return profile; // Retorna o perfil atualizado
  };
