import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
    createWorkspace,
    getWorkspace,
    getUserWorkspaces,
    getWorkspaceMembers,
    addWorkspaceMember,
    updateWorkspaceMemberRole,
    removeWorkspaceMember,
    createInviteLink,
    joinWorkspace
} from "../controllers/workspace.controller";

const router = Router();

// Secure all routes
router.use(protect);

router.post("/", createWorkspace);
router.get("/", getUserWorkspaces);
router.get("/:id", getWorkspace);

router.get("/:id/members", getWorkspaceMembers);
router.post("/:id/members", addWorkspaceMember);
router.patch("/:id/members/:userId", updateWorkspaceMemberRole);
router.delete("/:id/members/:userId", removeWorkspaceMember);

router.post("/join", joinWorkspace);
router.post("/:id/invite", createInviteLink);

export default router;
