import { Sequelize, DataTypes, Model } from 'sequelize';
import { Users } from './userModel';
import { Profile } from './profileModel';

export class UsersHaveProfile extends Model {
  public idUser!: number;
  public idProfile!: number;
}

// Definindo o relacionamento (associações) diretamente no modelo
export const initUsersHaveProfileModel = (sequelize: Sequelize): void => {
  UsersHaveProfile.init(
    {
      idUser: {
        type: DataTypes.INTEGER,
        references: {
          model: 'users', // A tabela de usuários
          key: 'id',
        },
      },
      idProfile: {
        type: DataTypes.INTEGER,
        references: {
          model: 'profiles', // A tabela de perfis
          key: 'id',
        },
      },
    },
    {
      sequelize,
      tableName: 'users_have_profile',
      timestamps: false,
    }
  );

  // Definindo o relacionamento (associações) depois de inicializar o modelo
  UsersHaveProfile.belongsTo(Users, { foreignKey: 'idUser' });
  UsersHaveProfile.belongsTo(Profile, { foreignKey: 'idProfile' });

  // Definindo as associações em User e Profile
  Users.hasMany(UsersHaveProfile, { foreignKey: 'idUser' });
  Profile.hasMany(UsersHaveProfile, { foreignKey: 'idProfile' });
};

export default UsersHaveProfile;
