import { Request, Response } from 'express';
import { deleteUserController } from './mocks/mockDeleteUserController';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Função de criação de mocks para Request e Response
describe('deleteUserController', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock<any>;
    let statusMock: jest.Mock<any>;
  
    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  
      req = { params: {} }; // Inicializa req com um objeto vazio para os params
  
      // Mock do Response com status e json
      res = {
        status: statusMock,
      };
    });
  
    it('deve retornar 200 e mensagem de sucesso se o usuário for deletado com sucesso', () => {
      req.params = { userId: '1' }; // Simulando que o userId é 1
  
      // Chama a função do controlador
      deleteUserController(req as Request, res as Response);
  
      // Verificando se o status e json foram chamados com os parâmetros esperados
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'User deleted successfully' });
    });
  
    it('deve retornar 404 se o usuário não for encontrado', () => {
      req.params = { userId: '3' }; // Simulando que o userId 3 não existe
  
      deleteUserController(req as Request, res as Response);
  
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'User not found' });
    });
  
    it('deve retornar 400 se o userId não for fornecido', () => {
      req.params = {}; // Simulando que o userId não foi fornecido
  
      deleteUserController(req as Request, res as Response);
  
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'User ID is required' });
    });  
    
  });