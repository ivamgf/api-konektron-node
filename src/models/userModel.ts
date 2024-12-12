// userModel.ts
import { Sequelize, DataTypes, Model } from 'sequelize';
import bcrypt from 'bcryptjs'; // Certifique-se de que bcryptjs está instalado

export interface UserAttributes {
  id?: number;
  email: string;
  password: string;
  type?: string;
  enabled: boolean;
  dateCreate: Date;
  dateUpdate?: Date;
}

export class User extends Model<UserAttributes> implements UserAttributes {
  public id?: number;
  public email!: string;
  public password!: string;
  public type?: string;
  public enabled!: boolean;
  public dateCreate!: Date;
  public dateUpdate?: Date;
}

// Função para inicializar o modelo User
export const initUserModel = (sequelize: Sequelize): void => {
  User.init(
    {
      id: {
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
    },
    {
      sequelize,
      tableName: 'users',
      timestamps: false,
    }
  );

  // Hook para criptografar a senha antes de salvar no banco
  User.addHook('beforeCreate', async (user: User) => {
    user.password = await bcrypt.hash(user.password, 10);
  });

  User.addHook('beforeUpdate', async (user: User) => {
    if (user.changed('password')) {
      user.password = await bcrypt.hash(user.password, 10);
    }
  });
};

// Função para buscar usuário pelo email
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const user = await User.findOne({ where: { email } });
  return user || null;
};
