import { Request, Response } from "express";
import mockData from "./mockData.json";

export class MockUserStoriesController {
  static async createUserStory(req: Request, res: Response) {
    const { analysisId, ...data } = req.body;

    const newUserStory = {
      idUserStories: mockData.userStories.length + 1,
      ...data,
    };
    mockData.userStories.push(newUserStory);

    if (analysisId) {
      mockData.analisysHaveUserStories.push({
        idAnalysis: analysisId,
        idUserStory: newUserStory.idUserStories,
      });
    }

    res.status(201).json(newUserStory);
  }

  static async getAllUserStories(req: Request, res: Response) {
    res.status(200).json(mockData.userStories);
  }

  static async getUserStoryById(req: Request, res: Response) {
    const { id } = req.params;
    const userStory = mockData.userStories.find(
      (story) => story.idUserStories === Number(id)
    );

    if (!userStory) {
      return res.status(404).json({ message: "User Story not found" });
    }

    res.status(200).json(userStory);
  }

  static async updateUserStory(req: Request, res: Response) {
    const { id } = req.params;
    const data = req.body;
    const userStory = mockData.userStories.find(
      (story) => story.idUserStories === Number(id)
    );

    if (!userStory) {
      return res.status(404).json({ message: "User Story not found" });
    }

    Object.assign(userStory, data);
    res.status(200).json(userStory);
  }

  static async deleteUserStory(req: Request, res: Response) {
    const { id } = req.params;
    const userStoryIndex = mockData.userStories.findIndex(
      (story) => story.idUserStories === Number(id)
    );

    if (userStoryIndex === -1) {
      return res.status(404).json({ message: "User Story not found" });
    }

    // Remove relações em `analisysHaveUserStories`
    mockData.analisysHaveUserStories = mockData.analisysHaveUserStories.filter(
      (relation) => relation.idUserStory !== Number(id)
    );

    // Remove a user story
    mockData.userStories.splice(userStoryIndex, 1);
    res.status(204).send();
  }
}
