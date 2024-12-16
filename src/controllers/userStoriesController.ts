import { Request, Response } from "express";
import { UserStories } from "../models/userStoriesModel";
import { AnalisysHaveUserStories } from "../models/analisysHaveUserStories";

export class UserStoriesController {
    static async createUserStory(req: Request, res: Response) {
        try {
            const { analysisId, ...data } = req.body;
            const userStory = await UserStories.create(data);
            // Criar o relacionamento na tabela AnalisysHaveUserStories
            if (analysisId) {
                await AnalisysHaveUserStories.create({
                    idAnalysis: analysisId,
                    idUserStory: userStory.idUserStories, // id gerado na criação do userStory
                });
            }
            res.status(201).json(userStory);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar a user stories.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAllUserStories(req: Request, res: Response) {
        try {
            const userStories = await UserStories.findAll();
            res.status(200).json(userStories);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar as user stories.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getUserStoryById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userStory = await UserStories.findByPk(id);
            if (!userStory) {
                return res.status(404).json({ message: "User Story not found" });
            }
            res.status(200).json(userStory);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar a user stories.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async updateUserStory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;
            const userStory = await UserStories.findByPk(id);

            if (!userStory) {
                return res.status(404).json({ message: "User Story not found" });
            }

            await userStory.update(data);
            res.status(200).json(userStory);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar a user stories.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async deleteUserStory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userStory = await UserStories.findByPk(id);

            if (!userStory) {
                return res.status(404).json({ message: "User Story not found" });
            }

            await AnalisysHaveUserStories.destroy({
                where: { idUserStory: id },
            });

            await userStory.destroy();
            res.status(204).send();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir a user stories.';
            res.status(500).json({ error: errorMessage });
        }
    }
}
