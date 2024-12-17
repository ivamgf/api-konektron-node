import { Request, Response } from "express";
import mockData from "./mockData.json";

export class MockRequirementsController {
  static async createRequirement(req: Request, res: Response) {
    const { idAnalisys, ...requirementData } = req.body;

    if (!idAnalisys) {
      return res.status(400).json({ error: "idAnalisys is required." });
    }

    // Simula a criação de um novo requisito
    const newRequirement = {
      idRequirements: mockData.requirements.length + 1,
      ...requirementData,
    };
    mockData.requirements.push(newRequirement);

    // Simula a associação
    const newAssociation = {
      idAnalisys,
      idRequirements: newRequirement.idRequirements,
    };
    mockData.analisysHaveRequirements.push(newAssociation);

    res.status(201).json(newRequirement);
  }

  static async getAllRequirements(req: Request, res: Response) {
    res.status(200).json(mockData.requirements);
  }

  static async getRequirementById(req: Request, res: Response) {
    const { id } = req.params;
    const requirement = mockData.requirements.find(
      (r) => r.idRequirements === Number(id)
    );

    if (!requirement) {
      return res.status(404).json({ message: "Requirement not found" });
    }
    res.status(200).json(requirement);
  }

  static async updateRequirement(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body;

    const requirementIndex = mockData.requirements.findIndex(
      (r) => r.idRequirements === Number(id)
    );

    if (requirementIndex === -1) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    mockData.requirements[requirementIndex] = {
      ...mockData.requirements[requirementIndex],
      ...data,
    };

    res.status(200).json(mockData.requirements[requirementIndex]);
  }

  static async deleteRequirement(req: Request, res: Response) {
    const { id } = req.params;

    const requirementIndex = mockData.requirements.findIndex(
      (r) => r.idRequirements === Number(id)
    );

    if (requirementIndex === -1) {
      return res.status(404).json({ message: "Requirement not found" });
    }

    // Remove o requisito e associações relacionadas
    mockData.requirements.splice(requirementIndex, 1);
    mockData.analisysHaveRequirements = mockData.analisysHaveRequirements.filter(
      (a) => a.idRequirements !== Number(id)
    );

    res.status(204).send();
  }
}
