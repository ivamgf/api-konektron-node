import request from "supertest";
import { MockUserStoriesController } from "./mocks/mockUserStoriesController";
import express from "express";
import { describe, test, expect } from '@jest/globals';

const app = express();
app.use(express.json());

app.post("/user-stories", MockUserStoriesController.createUserStory);
app.get("/user-stories", MockUserStoriesController.getAllUserStories);
app.get("/user-stories/:id", MockUserStoriesController.getUserStoryById);
app.put("/user-stories/:id", MockUserStoriesController.updateUserStory);
app.delete("/user-stories/:id", MockUserStoriesController.deleteUserStory);

describe("User Stories Controller Tests", () => {
  test("Should create a new user story", async () => {
    const response = await request(app)
      .post("/user-stories")
      .send({
        title: "As a developer, I want to write tests",
        description: "Ensure code reliability and avoid regressions",
        priority: "High",
        analysisId: 103,
      });

    expect(response.status).toBe(201);
    expect(response.body.title).toBe("As a developer, I want to write tests");
    expect(response.body.idUserStories).toBeDefined();
  });

  test("Should fetch all user stories", async () => {
    const response = await request(app).get("/user-stories");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });

  test("Should fetch a user story by ID", async () => {
    const response = await request(app).get("/user-stories/1");

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("As a user, I want to register my account");
  });

  test("Should update a user story", async () => {
    const response = await request(app)
      .put("/user-stories/1")
      .send({ priority: "Medium" });

    expect(response.status).toBe(200);
    expect(response.body.priority).toBe("Medium");
  });

  test("Should delete a user story", async () => {
    const response = await request(app).delete("/user-stories/1");

    expect(response.status).toBe(204);
  });

  test("Should return 404 for non-existent user story", async () => {
    const response = await request(app).get("/user-stories/999");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("User Story not found");
  });
});
