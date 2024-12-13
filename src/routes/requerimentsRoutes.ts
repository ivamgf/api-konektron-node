import { Router } from "express";
import { RequirementsController } from "../controllers/requerimentsController";

const router = Router();

router.post("/", RequirementsController.createRequirement);
router.get("/", RequirementsController.getAllRequirements);
router.get("/:id", RequirementsController.getRequirementById);
router.put("/:id", RequirementsController.updateRequirement);
router.delete("/:id", RequirementsController.deleteRequirement);

export default router;
