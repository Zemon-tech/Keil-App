import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember, requireParentTaskAssignee } from "../middlewares/org-context.middleware";
import { requireSpaceRole } from "../middlewares/rbac.middleware";
import { taskCreationRateLimiter } from "../middlewares/rate-limiter.middleware";
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
  createSubtask,
  getSlots,
  createSlot,
  updateSlot,
  deleteSlot,
  getChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getTaskAiSummary,
  regenerateTaskAiSummary,
} from "../controllers/org-task.controller";

const router = Router({ mergeParams: true });

router.use(protect, requireOrgMember, requireSpaceMember);

// Time Slots routes
router.get("/slots", requireSpaceRole("admin", "manager", "member"), getSlots);
router.post("/slots", requireSpaceRole("admin", "manager", "member"), createSlot);
router.patch("/slots/:slotId", requireSpaceRole("admin", "manager", "member"), updateSlot);
router.delete("/slots/:slotId", requireSpaceRole("admin", "manager", "member"), deleteSlot);

router.post("/", taskCreationRateLimiter, requireSpaceRole("admin", "manager"), createTask);
router.get("/", requireSpaceRole("admin", "manager", "member"), getTasks);
router.get("/:id", requireSpaceRole("admin", "manager", "member"), getTaskById);
router.patch("/:id", requireSpaceRole("admin", "manager"), updateTask);
router.delete("/:id", requireSpaceRole("admin", "manager"), deleteTask);

// Member subtask creation (id is parent_task_id)
router.post("/:id/subtasks", taskCreationRateLimiter, requireSpaceRole("admin", "manager", "member"), requireParentTaskAssignee, createSubtask);

// Personal Checklist routes (id is task_id)
router.get("/:id/checklists", requireSpaceRole("admin", "manager", "member"), getChecklists);
router.post("/:id/checklists", requireSpaceRole("admin", "manager", "member"), createChecklist);
router.patch("/:id/checklists/:checklistId", requireSpaceRole("admin", "manager", "member"), updateChecklist);
router.delete("/:id/checklists/:checklistId", requireSpaceRole("admin", "manager", "member"), deleteChecklist);

router.patch("/:id/status", requireSpaceRole("admin", "manager", "member"), changeTaskStatus);
router.post("/:id/assignees", requireSpaceRole("admin", "manager"), assignUserToTask);
router.delete("/:id/assignees/:userId", requireSpaceRole("admin", "manager"), removeUserFromTask);
router.post("/:id/dependencies", requireSpaceRole("admin", "manager"), addDependency);
router.delete("/:id/dependencies/:blockedByTaskId", requireSpaceRole("admin", "manager"), removeDependency);
router.get("/:id/subtasks", requireSpaceRole("admin", "manager", "member"), getSubtasks);
router.get("/:id/comments", requireSpaceRole("admin", "manager", "member"), getTaskComments);
router.post("/:id/comments", requireSpaceRole("admin", "manager", "member"), addTaskComment);
router.delete("/:id/comments/:commentId", requireSpaceRole("admin", "manager", "member"), deleteTaskComment);

// AI Summary routes
router.get("/:id/summary", requireSpaceRole("admin", "manager", "member"), getTaskAiSummary);
router.post("/:id/summary/regenerate", requireSpaceRole("admin", "manager", "member"), regenerateTaskAiSummary);

export default router;

