import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import { requireSpaceRole } from "../middlewares/rbac.middleware";
import {
  addDependency,
  addTaskComment,
  assignUserToTask,
  changeTaskStatus,
  createTask,
  deleteTask,
  deleteTaskComment,
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

router.post("/", requireSpaceRole("admin", "manager"), createTask);
router.get("/", requireSpaceRole("admin", "manager", "member"), getTasks);
router.get("/:id", requireSpaceRole("admin", "manager", "member"), getTaskById);
router.patch("/:id", requireSpaceRole("admin", "manager"), updateTask);
router.delete("/:id", requireSpaceRole("admin", "manager"), deleteTask);

router.patch("/:id/status", requireSpaceRole("admin", "manager", "member"), changeTaskStatus);
router.post("/:id/assignees", requireSpaceRole("admin", "manager"), assignUserToTask);
router.delete("/:id/assignees/:userId", requireSpaceRole("admin", "manager"), removeUserFromTask);
router.post("/:id/dependencies", requireSpaceRole("admin", "manager"), addDependency);
router.delete("/:id/dependencies/:blockedByTaskId", requireSpaceRole("admin", "manager"), removeDependency);
router.get("/:id/subtasks", requireSpaceRole("admin", "manager", "member"), getSubtasks);
router.get("/:id/comments", requireSpaceRole("admin", "manager", "member"), getTaskComments);
router.post("/:id/comments", requireSpaceRole("admin", "manager", "member"), addTaskComment);
router.delete("/:id/comments/:commentId", requireSpaceRole("admin", "manager", "member"), deleteTaskComment);

export default router;
