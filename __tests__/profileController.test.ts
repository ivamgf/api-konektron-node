import { mockGetProfileController, mockUpdateProfileController } from './mocks/mockProfileController';
import { Request, Response } from 'express';
import { jest, describe, it, beforeEach, expect } from '@jest/globals';

describe('MockProfileController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { params: {}, body: {} };
    res = { status: statusMock };
  });

  describe('mockGetProfileController', () => {
    it('deve retornar 200 quando o perfil for encontrado', async () => {
      req.params = { userId: '1' };

      await mockGetProfileController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        userId: 1,
        name: 'John Doe',
        email: 'john.doe@example.com',
        age: 30,
      });
    });

    it('deve retornar 404 quando o perfil não for encontrado', async () => {
      req.params = { userId: '999' };

      await mockGetProfileController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Perfil não encontrado para o usuário.',
      });
    });
  });

  describe('mockUpdateProfileController', () => {
    it('deve retornar 200 quando o perfil for atualizado com sucesso', async () => {
      req.params = { userId: '1' };
      req.body = { name: 'Updated John' };

      await mockUpdateProfileController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        message: 'Perfil atualizado com sucesso.',
        updatedProfile: {
          userId: 1,
          name: 'Updated John',
          email: 'john.doe@example.com',
          age: 30,
        },
      });
    });

    it('deve retornar 404 quando o perfil não for encontrado', async () => {
      req.params = { userId: '999' };
      req.body = { name: 'Nonexistent User' };

      await mockUpdateProfileController(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Perfil não encontrado para o usuário.',
      });
    });
  });
});
