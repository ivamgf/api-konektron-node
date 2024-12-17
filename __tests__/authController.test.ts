import { login } from './mocks/mockAuthController';
import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('AuthController - Login', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { body: {} }; // Inicializa req com um objeto vazio

    // Mock do Response com status e json
    res = {
      status: statusMock,
    };
  });

  it('deve retornar 400 se email ou senha não forem fornecidos', async () => {
    req.body = {}; // Garante que req.body está definido

    // Mock do comportamento do login para definir o código de status diretamente
    await login(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);  // Verifica se o status foi chamado com 400
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Email and password are required' });
  });

  it('deve retornar 400 para credenciais inválidas', async () => {
    req.body = { email: 'invalid@example.com', password: 'wrongpassword' };

    await login(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);  // Verifica se o status foi chamado com 400
    expect(jsonMock).toHaveBeenCalledWith({ message: 'Invalid credentials' });
  });

  it('deve retornar 200 e um token para credenciais válidas', async () => {
    req.body = { email: 'test@example.com', password: 'password123' };

    await login(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);  // Verifica se o status foi chamado com 200
    expect(jsonMock).toHaveBeenCalledWith({
      message: 'Login successful',
      token: 'mocked-token-for-user-1',
    });
  });
  
});
