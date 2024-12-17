import request from "supertest";
import express from "express";
import { MockAnalysisController } from "./mocks/mockAnalisysController";
import { describe, it, expect } from '@jest/globals';


const app = express();
app.use(express.json());

app.post("/analysis", MockAnalysisController.createAnalysis);
app.get("/analyses", MockAnalysisController.getAllAnalyses);
app.get("/analysis/:id", MockAnalysisController.getAnalysisById);
app.put("/analysis/:id", MockAnalysisController.updateAnalysis);
app.delete("/analysis/:id", MockAnalysisController.deleteAnalysis);

describe("MockAnalysisController", () => {
    it("should create an analysis", async () => {
        const response = await request(app)
            .post("/analysis")
            .send({ name: "Test Analysis", description: "This is a test." });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe("Test Analysis");
    });

    it("should fetch all analyses", async () => {
        const response = await request(app).get("/analyses");
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it("should fetch an analysis by id", async () => {
        const createResponse = await request(app)
            .post("/analysis")
            .send({ name: "Fetch Test", description: "To be fetched." });

        const { idAnalysis } = createResponse.body;

        const response = await request(app).get(`/analysis/${idAnalysis}`);
        expect(response.status).toBe(200);
        expect(response.body.name).toBe("Fetch Test");
    });

    it("should update an analysis", async () => {
        const createResponse = await request(app)
            .post("/analysis")
            .send({ name: "Update Test", description: "Original description." });

        const { idAnalysis } = createResponse.body;

        const response = await request(app)
            .put(`/analysis/${idAnalysis}`)
            .send({ description: "Updated description." });

        expect(response.status).toBe(200);
        expect(response.body.description).toBe("Updated description.");
    });

    it("should delete an analysis", async () => {
        const createResponse = await request(app)
            .post("/analysis")
            .send({ name: "Delete Test", description: "To be deleted." });

        const { idAnalysis } = createResponse.body;

        const response = await request(app).delete(`/analysis/${idAnalysis}`);
        expect(response.status).toBe(204);
    });
});
