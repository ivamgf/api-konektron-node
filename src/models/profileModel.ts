import { Sequelize, DataTypes, Model } from 'sequelize';
import { User } from './userModel';
import UsersHaveProfile from './usersHaveProfileModel';

export class Profile extends Model {
  public idProfile!: number;
  public name!: string;
  public nickname?: string;
  public phone?: string;
  public network1?: string;
  public network2?: string;
  public company?: string;
  public department?: string;
  public role?: string;
  public dateBirth?: Date;
  public addressLine1?: string;
  public addressLine2?: string;
  public number?: string;
  public complement?: string;
  public postalCode?: string;
  public district?: string;
  public city?: string;
  public province?: string;
  public dateCreate!: Date;
  public dateUpdate?: Date;
}

// Função para inicializar o modelo Profile e definir associações
export const initProfileModel = (sequelize: Sequelize): void => {
  Profile.init(
    {
      idProfile: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      nickname: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      network1: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      network2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      company: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dateBirth: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      addressLine1: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      addressLine2: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      complement: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      postalCode: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      district: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      province: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      dateCreate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      dateUpdate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'profiles',
      timestamps: false,
    }
  );

  // Relacionamentos
  Profile.hasMany(UsersHaveProfile, { foreignKey: 'idProfile', onDelete: 'CASCADE' });

  // Associação com Users através de UsersHaveProfile
  Profile.belongsToMany(User, {
    through: UsersHaveProfile,
    foreignKey: 'idProfile',
    otherKey: 'idUser',
  });
};

export default Profile;
