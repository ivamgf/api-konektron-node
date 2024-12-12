import { Request, Response } from 'express';
import { requestPasswordReset, resetPassword } from '../services/passwordRecoveryService';

export const requestPasswordResetController = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;

  const success = await requestPasswordReset(email);

  if (success) {
    return res.status(200).json({ message: 'Password reset email sent successfully.' });
  }

  return res.status(400).json({ message: 'User not found or invalid email.' });
};

export const resetPasswordController = async (req: Request, res: Response): Promise<Response> => {
  const { resetToken, newPassword } = req.body;

  const success = await resetPassword(resetToken, newPassword);

  if (success) {
    return res.status(200).json({ message: 'Password has been successfully updated.' });
  }

  return res.status(400).json({ message: 'Invalid or expired token.' });
};
