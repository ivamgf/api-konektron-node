import { Request, Response } from 'express';

export const mockRequestPasswordResetController = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;

  // Simulação de diferentes cenários
  if (email === 'test@example.com') {
    return res.status(200).json({ message: 'Password reset email sent successfully.' });
  }

  return res.status(400).json({ message: 'User not found or invalid email.' });
};

export const mockResetPasswordController = async (req: Request, res: Response): Promise<Response> => {
  const { resetToken, newPassword } = req.body;

  // Simulação de diferentes cenários
  if (resetToken === 'valid-reset-token' && newPassword) {
    return res.status(200).json({ message: 'Password has been successfully updated.' });
  }

  return res.status(400).json({ message: 'Invalid or expired token.' });
};
