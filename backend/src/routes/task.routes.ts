import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  changeTaskStatus,
  assignUserToTask,
  removeUserFromTask,
  addDependency,
  removeDependency,
  getSubtasks,
} from "../controllers/task.controller";

import { getTaskComments, addComment } from "../controllers/comment.controller";

const router = Router();

// All task endpoints require authenticated user context (req.user, req.workspaceId)
router.use(protect);

// Base Task Routes
router.post("/", createTask);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

// Status update (separated for complex logic)
router.patch("/:id/status", changeTaskStatus);

// Assignees
router.post("/:id/assignees", assignUserToTask);
router.delete("/:id/assignees/:userId", removeUserFromTask);

// Dependencies
router.post("/:id/dependencies", addDependency);
router.delete("/:id/dependencies/:blockedByTaskId", removeDependency);

// Subtasks
router.get("/:id/subtasks", getSubtasks);

// Comments (Nested under tasks for creation and reading)
router.get("/:id/comments", getTaskComments);
router.post("/:id/comments", addComment);

export default router;
