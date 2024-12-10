import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../models/userModel'; // Certifique-se de que está importando a função corretamente
import { compare } from 'bcryptjs'; // Certifique-se de usar 'bcryptjs'
import { JWT_SECRET } from '../config';

export const validateUserCredentials = async (email: string, password: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    return null;
  }

  const isPasswordValid = await compare(password, user.password);

  if (!isPasswordValid) {
    return null;
  }

  return user;
};

export const generateToken = (userId: number): string => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
};
