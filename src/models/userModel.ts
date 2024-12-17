// userModel.ts
import { Sequelize, DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs'; // Certifique-se de que bcryptjs está instalado

export interface UserAttributes {
  idUser?: number;
  email: string;
  password: string;
  type?: string;
  enabled: boolean;
  dateCreate: Date;
  dateUpdate?: Date;
  resetToken?: string | null; // Nova propriedade
  resetTokenExpiration?: Date | null; // Nova propriedade
}

export class Users extends Model<UserAttributes> implements UserAttributes {
  public idUser?: number;
  public email!: string;
  public password!: string;
  public type?: string;
  public enabled!: boolean;
  public dateCreate!: Date;
  public dateUpdate?: Date;
  public resetToken?: string | null; // Nova propriedade
  public resetTokenExpiration?: Date | null; // Nova propriedade
}

// Função para inicializar o modelo User
export const initUserModel = (sequelize: Sequelize): void => {
  Users.init(
    {
      idUser: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      dateCreate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      dateUpdate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resetToken: { // Definição do token de recuperação
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetTokenExpiration: { // Definição da data de expiração
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'users',
      timestamps: true,  // Configuração de timestamps (automaticamente cria createdAt e updatedAt)
      createdAt: 'dateCreate',
      updatedAt: 'dateUpdate',
    }
  );

  // Hook para criptografar a senha antes de salvar no banco
  Users.addHook('beforeCreate', async (user: Users) => {
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 10);
    }
  });

  Users.addHook('beforeUpdate', async (user: Users) => {
    if (user.changed('password') && user.password) {
      user.password = await bcrypt.hash(user.password, 10);
    }
  });
};

// Função para buscar usuário pelo email
export const getUserByEmail = async (email: string): Promise<Users | null> => {
  const user = await Users.findOne({ where: { email } });
  return user || null;
};
