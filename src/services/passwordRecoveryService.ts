import crypto from 'crypto';
import { User } from '../models/userModel';
import { sendRecoveryEmail } from '../utils/emailSender'; // Função para enviar o email
import { Op } from 'sequelize';

export const generateResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const requestPasswordReset = async (email: string): Promise<boolean> => {
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return false; // Usuário não encontrado
  }

  const resetToken = generateResetToken();
  const resetTokenExpiration = new Date(Date.now() + 3600000); // Expira em 1 hora

  user.resetToken = resetToken;
  user.resetTokenExpiration = resetTokenExpiration;

  await user.save();

  // Envia o email com o link para a recuperação de senha
  await sendRecoveryEmail(user.email, resetToken);

  return true;
};

export const verifyResetToken = async (resetToken: string): Promise<User | null> => {
  const user = await User.findOne({
    where: {
      resetToken,
      resetTokenExpiration: { [Op.gt]: new Date() }, // Verifica se o token não expirou
    },
  });

  return user;
};

export const resetPassword = async (resetToken: string, newPassword: string): Promise<boolean> => {
  const user = await verifyResetToken(resetToken);

  if (!user) {
    return false; // Token inválido ou expirado
  }

  user.password = newPassword;
  user.resetToken = null; // Limpa o token após a atualização
  user.resetTokenExpiration = null;

  await user.save();

  return true;
};
