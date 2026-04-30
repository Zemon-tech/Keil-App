import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  changePersonalTaskStatus,
  createPersonalTask,
  deletePersonalTask,
  getPersonalTaskById,
  getPersonalTasks,
  updatePersonalTask,
} from "../controllers/personal-task.controller";

const router = Router();

router.use(protect);

router.get("/tasks", getPersonalTasks);
router.post("/tasks", createPersonalTask);
router.get("/tasks/:id", getPersonalTaskById);
router.patch("/tasks/:id", updatePersonalTask);
router.delete("/tasks/:id", deletePersonalTask);
router.patch("/tasks/:id/status", changePersonalTaskStatus);

export default router;
