import { Router } from "express";
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
    removeDependency
} from "../controllers/task.controller";

import {
    getTaskComments,
    addComment
} from "../controllers/comment.controller";

const router = Router();

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

// Comments (Nested under tasks for creation and reading)
router.get("/:id/comments", getTaskComments);
router.post("/:id/comments", addComment);

export default router;
