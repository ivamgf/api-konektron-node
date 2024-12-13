import { Router } from "express";
import { UserStoriesController } from "../controllers/userStoriesController";

const router = Router();

router.post("/", UserStoriesController.createUserStory);
router.get("/", UserStoriesController.getAllUserStories);
router.get("/:id", UserStoriesController.getUserStoryById);
router.put("/:id", UserStoriesController.updateUserStory);
router.delete("/:id", UserStoriesController.deleteUserStory);

export default router;
