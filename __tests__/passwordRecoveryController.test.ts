import { mockRequestPasswordResetController, mockResetPasswordController } from './mocks/mockPasswordRecoveryController';
import { Request, Response } from 'express';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('MockPasswordRecoveryController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { body: {} };
    res = { status: statusMock };
  });

  describe('mockRequestPasswordResetController', () => {
    it('deve retornar 200 quando o email existir', async () => {
      req.body = { email: 'test@example.com' };

      await mockRequestPasswordResetController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Password reset email sent successfully.',
      });
    });

    it('deve retornar 400 quando o email não existir', async () => {
      req.body = { email: 'nonexistent@example.com' };

      await mockRequestPasswordResetController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'User not found or invalid email.',
      });
    });
  });

  describe('mockResetPasswordController', () => {
    it('deve retornar 200 quando o token for válido', async () => {
      req.body = { resetToken: 'valid-reset-token', newPassword: 'newPassword123' };

      await mockResetPasswordController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Password has been successfully updated.',
      });
    });

    it('deve retornar 400 quando o token for inválido', async () => {
      req.body = { resetToken: 'invalid-token', newPassword: 'newPassword123' };

      await mockResetPasswordController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Invalid or expired token.',
      });
    });
  });
});
