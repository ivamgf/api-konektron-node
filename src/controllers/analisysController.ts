import { Request, Response } from "express";
import { Analysis } from "../models/analisysModel";
import { UsersHaveAnalysis } from "../models/usersHaveAnalisys";

export class AnalysisController {
    static async createAnalysis(req: Request, res: Response) {
        try {
            const { userId, ...data } = req.body;
            const analysis = await Analysis.create(data);
            // Criar o relacionamento na tabela UsersHaveAnalysis
            if (userId) {
                await UsersHaveAnalysis.create({
                    idUser: userId,
                    idAnalysis: analysis.idAnalysis,
                });
            }
            res.status(201).json(analysis);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar projeto.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAllAnalyses(req: Request, res: Response) {
        try {
            const analyses = await Analysis.findAll();
            res.status(200).json(analyses);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar projetos.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAnalysisById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const analysis = await Analysis.findByPk(id);
            if (!analysis) {
                return res.status(404).json({ message: "Analysis not found" });
            }
            res.status(200).json(analysis);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar projeto.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async updateAnalysis(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;
            const analysis = await Analysis.findByPk(id);

            if (!analysis) {
                return res.status(404).json({ message: "Analysis not found" });
            }

            await analysis.update(data);
            res.status(200).json(analysis);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar projeto.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async deleteAnalysis(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const analysis = await Analysis.findByPk(id);

            if (!analysis) {
                return res.status(404).json({ message: "Analysis not found" });
            }

            // Remover registros relacionados em UsersHaveAnalysis
            await UsersHaveAnalysis.destroy({
                where: {
                    idAnalysis: id,
                },
            });

            await analysis.destroy();
            res.status(204).send();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao deletar projeto.';
            res.status(500).json({ error: errorMessage });
        }
    }
}
