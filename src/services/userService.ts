import { User } from '../models/userModel';
import bcrypt from 'bcrypt';
import { sendConfirmationEmail } from '../utils/emailSender';

export const createUser = async (email: string, password: string, type?: string): Promise<User> => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    password: hashedPassword,
    type,
    enabled: false,
    dateCreate: new Date(),
  });

  // Enviar email de confirmação
  await sendConfirmationEmail(user);

  return user;
};

export const enableUser = async (userId: number): Promise<User | null> => {
  const user = await User.findByPk(userId);
  if (user) {
    user.enabled = true;
    user.dateUpdate = new Date();
    await user.save();
  }
  return user;
};
