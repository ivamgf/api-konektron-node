import { Request, Response } from "express";
import { Requirements } from "../models/requerimentsModel";
import { AnalisysHaveRequirements } from "../models/analisysHaveRequirementsModel";

export class RequirementsController {
    static async createRequirement(req: Request, res: Response) {
        try {
            const { idAnalisys, ...requirementData } = req.body;

            if (!idAnalisys) {
                return res.status(400).json({ error: "idAnalisys is required." });
            }

            // Criação do requisito
            const requirement = await Requirements.create(requirementData);

            // Criação da associação na tabela AnalisysHaveRequirements
            await AnalisysHaveRequirements.create({
                idAnalisys,
                idRequirements: requirement.idRequirements
            });

            res.status(201).json(requirement);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao criar o requisito.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getAllRequirements(req: Request, res: Response) {
        try {
            const requirements = await Requirements.findAll();
            res.status(200).json(requirements);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar os requisitos.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async getRequirementById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const requirement = await Requirements.findByPk(id);
            if (!requirement) {
                return res.status(404).json({ message: "Requirement not found" });
            }
            res.status(200).json(requirement);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao consultar o requisito.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async updateRequirement(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const data = req.body;
            const requirement = await Requirements.findByPk(id);

            if (!requirement) {
                return res.status(404).json({ message: "Requirement not found" });
            }

            await requirement.update(data);
            res.status(200).json(requirement);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar o requisito.';
            res.status(500).json({ error: errorMessage });
        }
    }

    static async deleteRequirement(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const requirement = await Requirements.findByPk(id);

            if (!requirement) {
                return res.status(404).json({ message: "Requirement not found" });
            }

            // Excluir associação na tabela AnalisysHaveRequirements
            await AnalisysHaveRequirements.destroy({
                where: { idRequirements: requirement.idRequirements }
            });

            // Excluir o requisito
            await requirement.destroy();

            res.status(204).send();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro ao excluir o requisito.';
            res.status(500).json({ error: errorMessage });
        }
    }
}
