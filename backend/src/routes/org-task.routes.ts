import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import {
  addDependency,
  addTaskComment,
  assignUserToTask,
  changeTaskStatus,
  createTask,
  deleteTask,
  getSubtasks,
  getTaskById,
  getTaskComments,
  getTasks,
  removeDependency,
  removeUserFromTask,
  updateTask,
} from "../controllers/org-task.controller";

const router = Router({ mergeParams: true });

router.use(protect, requireOrgMember, requireSpaceMember);

router.post("/", createTask);
router.get("/", getTasks);
router.get("/:id", getTaskById);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

router.patch("/:id/status", changeTaskStatus);
router.post("/:id/assignees", assignUserToTask);
router.delete("/:id/assignees/:userId", removeUserFromTask);
router.post("/:id/dependencies", addDependency);
router.delete("/:id/dependencies/:blockedByTaskId", removeDependency);
router.get("/:id/subtasks", getSubtasks);
router.get("/:id/comments", getTaskComments);
router.post("/:id/comments", addTaskComment);

export default router;
