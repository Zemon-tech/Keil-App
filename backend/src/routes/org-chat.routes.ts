import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireOrgMember, requireSpaceMember } from "../middlewares/org-context.middleware";
import {
  addChannelMembers,
  createDirectChannel,
  createGroupChannel,
  getChannelMessages,
  getUserChannels,
  markChannelAsRead,
  removeChannelMember,
} from "../controllers/org-chat.controller";

const router = Router({ mergeParams: true });

router.use(protect, requireOrgMember, requireSpaceMember);

router.post("/channels/direct", createDirectChannel);
router.post("/channels/group", createGroupChannel);
router.get("/channels", getUserChannels);
router.get("/channels/:id/messages", getChannelMessages);
router.post("/channels/:id/read", markChannelAsRead);
router.post("/channels/:id/members", addChannelMembers);
router.delete("/channels/:id/members/:userId", removeChannelMember);

export default router;
