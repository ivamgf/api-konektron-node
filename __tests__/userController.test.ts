import request from "supertest";
import { MockUserController } from "./mocks/mockUserProfile";
import express from "express";
import { test, describe, expect } from '@jest/globals';

const app = express();
app.use(express.json());

app.post("/register", MockUserController.registerUser);
app.put("/confirm/:userId", MockUserController.confirmUser);
app.patch("/change-password/:userId", MockUserController.changePassword);
app.get("/users/:userId?", MockUserController.queryUsers);
app.delete("/users/:userId", MockUserController.deleteUserController);

describe("User Controller Tests", () => {
  test("Should register a new user", async () => {
    const response = await request(app)
      .post("/register")
      .send({ email: "test@example.com", password: "test123", type: "user" });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe("Usuário criado. Verifique seu e-mail para confirmar.");
    expect(response.body.userId).toBeDefined();
  });

  test("Should confirm a user", async () => {
    const response = await request(app).put("/confirm/2");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Usuário confirmado com sucesso.");
  });

  test("Should change user password", async () => {
    const response = await request(app)
      .patch("/change-password/1")
      .send({ newPassword: "newPassword123" });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Senha atualizada com sucesso.");
  });

  test("Should fetch all users", async () => {
    const response = await request(app).get("/users");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(1);
  });

  test("Should delete a user", async () => {
    const response = await request(app).delete("/users/1");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Usuário e suas associações deletados com sucesso.");
  });
});
