import { Router } from "express";
import { deleteComment } from "../controllers/comment.controller";

const router = Router();

// Base Comments Routes (for operations where task ID is not needed)
// Read/Create are nested under Tasks (/api/v1/tasks/:id/comments => handled in task.routes.ts)

router.delete("/:id", deleteComment);

export default router;
