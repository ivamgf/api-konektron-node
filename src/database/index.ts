// Configuração principal do Sequelize
import { Sequelize, DataTypes, Model } from 'sequelize';
import { initRequerimentsModel, Requirements } from "../models/requerimentsModel";
import { initAnalisysHaveRequirementsModel, AnalisysHaveRequirements } from "../models/analisysHaveRequirementsModel";
import dotenv from 'dotenv';

// Configuração da conexão com o banco de dados, considerando diferentes ambientes
let sequelize: Sequelize;

if (process.env.NODE_ENV !== 'test') {
  sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.DB_HOST || 'orkneytech.com.br',
    username: process.env.DB_USER || 'orkney10_konektron_admin',
    password: process.env.DB_PASS || '*',
    database: process.env.DB_NAME || 'orkney10_konektron',
    pool: {
      max: 30,
      min: 0,
      acquire: 30000, // Tempo máximo de espera para adquirir uma conexão
      idle: 60000, // Tempo máximo de inatividade antes de liberar uma conexão
    },
    dialectOptions: {
      charset: 'utf8mb4',
    },
  });
} else {
  // Configuração para testes usando SQLite em memória
  sequelize = new Sequelize('sqlite::memory:');
}

// Inicializando os modelos
initRequerimentsModel(sequelize);
initAnalisysHaveRequirementsModel(sequelize);

// Configurando associações
Requirements.hasMany(AnalisysHaveRequirements, {
  foreignKey: "idRequirements",
  as: "analisysAssociations",
});
AnalisysHaveRequirements.belongsTo(Requirements, {
  foreignKey: "idRequirements",
  as: "requirement",
});

// Adicionando o setInterval para manter a conexão ativa (somente em produção)
if (process.env.NODE_ENV !== 'test') {
  setInterval(async () => {
    try {
      await sequelize.authenticate(); // Faz um "ping" para manter a conexão ativa
      console.log('Connection is still alive');
    } catch (error) {
      console.error('Unable to connect to the database:', error);
    }
  }, 60000); // Intervalo de 1 minuto
}

// Definição do modelo User
class User extends Model {}

User.init(
  {
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
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resetTokenExpiration: {
      type: DataTypes.DATE,
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
    tableName: 'users',
    timestamps: false, 
  }
);

// Definição do modelo Profile
class Profile extends Model {}

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

// Definição do modelo UsersHaveProfile
class UsersHaveProfile extends Model {}

UsersHaveProfile.init({}, { sequelize, tableName: 'users_have_profile' });

// Configurando associações entre modelos
User.hasMany(UsersHaveProfile, { foreignKey: 'idUser', onDelete: 'CASCADE' });
Profile.hasMany(UsersHaveProfile, { foreignKey: 'idProfile', onDelete: 'CASCADE' });
UsersHaveProfile.belongsTo(User, { foreignKey: 'idUser' });
UsersHaveProfile.belongsTo(Profile, { foreignKey: 'idProfile' });

// Sincronizando o banco de dados
sequelize.sync();

afterAll(() => {
  // Fecha a conexão com o banco após os testes
  sequelize.close();
});

export { sequelize, User, Profile, UsersHaveProfile };
