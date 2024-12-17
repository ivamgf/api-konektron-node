import { MockRequirementsController } from "./mocks/mockRequirementsController";
import { jest, describe, it, beforeEach, expect } from "@jest/globals";
import { Request, Response } from "express";

describe("MockRequirementsController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock<any>;
  let statusMock: jest.Mock<any>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: jest.fn() });

    req = { params: {}, body: {} };
    res = { status: statusMock };
  });

  describe("createRequirement", () => {
    it("deve criar um requisito e retornar 201", async () => {
      req.body = { idAnalisys: 1, name: "New Requirement", description: "Test" };

      await MockRequirementsController.createRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        idRequirements: expect.any(Number),
        name: "New Requirement",
        description: "Test",
      });
    });

    it("deve retornar 400 se idAnalisys não for fornecido", async () => {
      req.body = { name: "New Requirement", description: "Test" };

      await MockRequirementsController.createRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "idAnalisys is required.",
      });
    });
  });

  describe("getAllRequirements", () => {
    it("deve retornar todos os requisitos", async () => {
      await MockRequirementsController.getAllRequirements(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe("getRequirementById", () => {
    it("deve retornar 200 e o requisito se encontrado", async () => {
      req.params = { id: "1" };

      await MockRequirementsController.getRequirementById(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        idRequirements: 1,
        name: "Requirement 1",
        description: "Description for requirement 1",
      });
    });

    it("deve retornar 404 se o requisito não for encontrado", async () => {
      req.params = { id: "999" };

      await MockRequirementsController.getRequirementById(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Requirement not found",
      });
    });
  });

  describe("updateRequirement", () => {
    it("deve atualizar um requisito existente", async () => {
      req.params = { id: "1" };
      req.body = { name: "Updated Requirement" };

      await MockRequirementsController.updateRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Requirement" })
      );
    });

    it("deve retornar 404 se o requisito não for encontrado", async () => {
      req.params = { id: "999" };
      req.body = { name: "Updated Requirement" };

      await MockRequirementsController.updateRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Requirement not found",
      });
    });
  });

  describe("deleteRequirement", () => {
    it("deve excluir um requisito existente", async () => {
      req.params = { id: "1" };

      await MockRequirementsController.deleteRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it("deve retornar 404 se o requisito não for encontrado", async () => {
      req.params = { id: "999" };

      await MockRequirementsController.deleteRequirement(
        req as Request,
        res as Response
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Requirement not found",
      });
    });
  });
});
