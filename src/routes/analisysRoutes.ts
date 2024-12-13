import { Router } from "express";
import { AnalysisController } from "../controllers/analisysController";

const router = Router();

router.post("/", AnalysisController.createAnalysis);
router.get("/", AnalysisController.getAllAnalyses);
router.get("/:id", AnalysisController.getAnalysisById);
router.put("/:id", AnalysisController.updateAnalysis);
router.delete("/:id", AnalysisController.deleteAnalysis);

export default router;
