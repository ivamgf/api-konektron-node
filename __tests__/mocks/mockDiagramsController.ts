import { Request, Response } from "express";
import mockData from "./mockData.json";  // Dados mockados
import { MockData } from './mockDataTypes'; // Importa as interfaces

const typedMockData: MockData = mockData;

export class DiagramsController {
    static async createDiagram(req: Request, res: Response) {
        
        try {
            const { idAnalisys, ...data } = req.body;

            // Simula a criação de um diagrama e atribui um id automático
            const newDiagram = {
                idDiagrams: typedMockData.diagrams.length + 1,  // Incrementa o id para novos diagramas
                ...data
            };
            typedMockData.diagrams.push(newDiagram);  // Adiciona o novo diagrama

            // Criar o relacionamento (mockado)
            if (idAnalisys) {
                // Simula o relacionamento na tabela AnalisysHaveDiagrams
                console.log(`Relacionando o diagrama com idAnalisys: ${idAnalisys}`);
            }

            res.status(201).json(newDiagram);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAllDiagrams(req: Request, res: Response) {
        try {
            res.status(200).json(typedMockData.diagrams);  // Retorna todos os diagramas mockados
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar os diagramas.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getDiagramById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const diagram = typedMockData.diagrams.find(d => d.idDiagrams === parseInt(id));
            
            if (!diagram) {
                return res.status(404).json({ message: "Diagram not found" });
            }

            res.status(200).json(diagram);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async updateDiagram(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;
            const diagramIndex = typedMockData.diagrams.findIndex(d => d.idDiagrams === parseInt(id));

            if (diagramIndex === -1) {
                return res.status(404).json({ message: "Diagram not found" });
            }

            typedMockData.diagrams[diagramIndex] = { ...typedMockData.diagrams[diagramIndex], ...data };
            res.status(200).json(typedMockData.diagrams[diagramIndex]);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async deleteDiagram(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const diagramIndex = typedMockData.diagrams.findIndex(d => d.idDiagrams === parseInt(id));

            if (diagramIndex === -1) {
                return res.status(404).json({ message: "Diagram not found" });
            }

            typedMockData.diagrams.splice(diagramIndex, 1);  // Remove o diagrama da lista
            res.status(204).send();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }
}
