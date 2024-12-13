import { Request, Response } from "express";
import { Diagrams } from "../models/diagramsModel";

export class DiagramsController {
    static async createDiagram(req: Request, res: Response) {
        try {
            const data = req.body;
            const diagram = await Diagrams.create(data);
            res.status(201).json(diagram);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAllDiagrams(req: Request, res: Response) {
        try {
            const diagrams = await Diagrams.findAll();
            res.status(200).json(diagrams);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar os diagramas.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getDiagramById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const diagram = await Diagrams.findByPk(id);
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
            const diagram = await Diagrams.findByPk(id);

            if (!diagram) {
                return res.status(404).json({ message: "Diagram not found" });
            }

            await diagram.update(data);
            res.status(200).json(diagram);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async deleteDiagram(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const diagram = await Diagrams.findByPk(id);

            if (!diagram) {
                return res.status(404).json({ message: "Diagram not found" });
            }

            await diagram.destroy();
            res.status(204).send();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir o diagrama.';
            res.status(500).json({ error: errorMessage });
        }
    }
}
