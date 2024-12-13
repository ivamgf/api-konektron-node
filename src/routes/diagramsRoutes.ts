import { Router } from "express";
import { DiagramsController } from "../controllers/diagramsController";

const router = Router();

router.post("/", DiagramsController.createDiagram);
router.get("/", DiagramsController.getAllDiagrams);
router.get("/:id", DiagramsController.getDiagramById);
router.put("/:id", DiagramsController.updateDiagram);
router.delete("/:id", DiagramsController.deleteDiagram);

export default router;
