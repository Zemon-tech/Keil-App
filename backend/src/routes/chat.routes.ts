import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
    createDirectChannel,
    createGroupChannel,
    getUserChannels,
    getChannelMessages,
    markChannelAsRead,
    addChannelMembers,
    removeChannelMember
} from "../controllers/chat.controller";

const router = Router();

// All chat routes require authentication
router.use(protect);

router.post("/channels/direct", createDirectChannel);
router.post("/channels/group", createGroupChannel);
router.get("/channels", getUserChannels);
router.get("/channels/:id/messages", getChannelMessages);
router.post("/channels/:id/read", markChannelAsRead);
router.post("/channels/:id/members", addChannelMembers);
router.delete("/channels/:id/members/:userId", removeChannelMember);

export default router;
