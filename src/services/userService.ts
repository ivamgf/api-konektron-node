// userService.ts
import { User } from '../models/userModel';
import bcrypt from 'bcryptjs';
import { sendConfirmationEmail } from '../utils/emailSender';

// Função para criar um novo usuário
export const createUser = async (email: string, password: string, type?: string): Promise<User> => {
  const hashedPassword = await bcrypt.hash(password, 10); // Criptografa a senha
  const user = await User.create({
    email,
    password: hashedPassword,
    type,
    enabled: false, // Define o valor padrão explicitamente
    dateCreate: new Date(), // Data atual para criação
  });

  // Enviar email de confirmação
  await sendConfirmationEmail(user);

  return user;
};

// Função para habilitar um usuário
export const enableUser = async (userId: number): Promise<User | null> => {
  const user = await User.findByPk(userId);
  if (user) {
    user.enabled = true;
    user.dateUpdate = new Date(); // Atualiza a data de modificação
    await user.save();
  }
  return user;
};

// Função para atualizar a senha do usuário
export const updateUserPassword = async (userId: number, newPassword: string): Promise<User> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('Usuário não encontrado.');
  }
  user.password = await bcrypt.hash(newPassword, 10); // Criptografa a nova senha
  user.dateUpdate = new Date(); // Atualiza a data de modificação
  await user.save();
  return user;
};

// Função para buscar um usuário pelo email
export const getUserByEmail = async (email: string): Promise<User | null> => {
  return await User.findOne({ where: { email } });
};

// Função para deletar um usuário
export const deleteUser = async (userId: number): Promise<User | null> => {
  const user = await User.findByPk(userId);
  if (!user) {
    return null; // Usuário não encontrado
  }
  
  await user.destroy(); // Exclui o usuário do banco de dados
  return user; // Retorna o usuário deletado
};

// Função para buscar um usuário ou todos os usuários com base nos parâmetros
export const getUsers = async (userId?: number): Promise<User | User[]> => {
  if (userId) {
    // Busca um único usuário por ID
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }
    return user; // Retorna o usuário encontrado
  } else {
    // Caso o userId não seja fornecido, retorna todos os usuários
    const users = await User.findAll();
    return users; // Retorna todos os usuários
  }
};