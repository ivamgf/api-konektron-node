import { DiagramsController } from './mocks/mockDiagramsController';
import { Request, Response } from 'express';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import mockData from './mocks/mockData.json';

import { MockData } from './mocks/mockDataTypes'; // Importa as interfaces

const typedMockData: MockData = mockData;

describe('DiagramsController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = { body: {}, params: {} }; // Inicializa req com objetos vazios

    // Mock do Response com status e json
    res = {
      status: statusMock,
    };
  });

  it('deve retornar todos os diagramas', async () => {
    req.body = {}; // Requisitando todos os diagramas

    await DiagramsController.getAllDiagrams(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(typedMockData.diagrams);
  });

  it('deve retornar 404 se o diagrama não for encontrado', async () => {
    req.params = { id: '999' }; // ID inválido

    await DiagramsController.getDiagramById(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Diagram not found" });
  });

  it('deve criar um novo diagrama', async () => {
    req.body = { title: 'New Diagram', description: 'New Diagram Description' };

    await DiagramsController.createDiagram(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith({
      idDiagrams: typedMockData.diagrams.length,
      title: 'New Diagram',
      description: 'New Diagram Description'
    });
  });

  it('deve atualizar um diagrama existente', async () => {
    req.params = { id: '1' };
    req.body = { title: 'Updated Diagram' };

    await DiagramsController.updateDiagram(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      idDiagrams: 1,
      title: 'Updated Diagram',
      description: 'Description of Diagram 1'
    });
  });

  it('deve excluir um diagrama', async () => {
    req.params = { id: '1' };

    await DiagramsController.deleteDiagram(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(204);
  });
});
