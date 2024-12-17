import { Request, Response } from "express";
import fs from "fs";
import path from "path";

type Analysis = {
    idAnalysis: number;
    name?: string;
    description?: string;
};

type UserHaveAnalysis = {
    idUser: number;
    idAnalysis: number;
};

type MockData = {
    analyses: Analysis[];
    usersHaveAnalyses: UserHaveAnalysis[];
};

const jsonFilePath = path.resolve(__dirname, "mockData.json");

const readJsonFile = (): MockData => {
    const data = fs.readFileSync(jsonFilePath, "utf-8");
    return JSON.parse(data);
};

const writeJsonFile = (data: MockData): void => {
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
};

export class MockAnalysisController {
    static async createAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { userId, ...data } = req.body;
            const mockData = readJsonFile();

            const newAnalysis: Analysis = {
                idAnalysis: mockData.analyses.length + 1,
                ...data,
            };

            mockData.analyses.push(newAnalysis);

            if (userId) {
                mockData.usersHaveAnalyses.push({
                    idUser: userId,
                    idAnalysis: newAnalysis.idAnalysis,
                });
            }

            writeJsonFile(mockData);
            res.status(201).json(newAnalysis);
        } catch (error) {
            res.status(500).json({ error: "Error creating analysis." });
        }
    }

    static async getAllAnalyses(req: Request, res: Response): Promise<void> {
        try {
            const mockData = readJsonFile();
            res.status(200).json(mockData.analyses);
        } catch (error) {
            res.status(500).json({ error: "Error fetching analyses." });
        }
    }

    static async getAnalysisById(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const mockData = readJsonFile();
            const analysis = mockData.analyses.find((a: Analysis) => a.idAnalysis == Number(id));

            if (!analysis) {
                res.status(404).json({ message: "Analysis not found" });
                return;
            }

            res.status(200).json(analysis);
        } catch (error) {
            res.status(500).json({ error: "Error fetching analysis." });
        }
    }

    static async updateAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const data = req.body;
            const mockData = readJsonFile();
            const analysisIndex = mockData.analyses.findIndex((a: Analysis) => a.idAnalysis == Number(id));

            if (analysisIndex === -1) {
                res.status(404).json({ message: "Analysis not found" });
                return;
            }

            mockData.analyses[analysisIndex] = {
                ...mockData.analyses[analysisIndex],
                ...data,
            };

            writeJsonFile(mockData);
            res.status(200).json(mockData.analyses[analysisIndex]);
        } catch (error) {
            res.status(500).json({ error: "Error updating analysis." });
        }
    }

    static async deleteAnalysis(req: Request, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const mockData = readJsonFile();

            const analysisIndex = mockData.analyses.findIndex((a: Analysis) => a.idAnalysis == Number(id));

            if (analysisIndex === -1) {
                res.status(404).json({ message: "Analysis not found" });
                return;
            }

            mockData.analyses.splice(analysisIndex, 1);

            mockData.usersHaveAnalyses = mockData.usersHaveAnalyses.filter(
                (rel: UserHaveAnalysis) => rel.idAnalysis != Number(id)
            );

            writeJsonFile(mockData);
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: "Error deleting analysis." });
        }
    }
}
