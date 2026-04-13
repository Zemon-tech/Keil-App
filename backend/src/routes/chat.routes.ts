import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
    createDirectChannel,
    createGroupChannel,
    getUserChannels,
    getChannelMessages,
    markChannelAsRead,
    addChannelMembers,
    removeChannelMember,
    editMessage,
    deleteMessage,
    pinMessage,
    toggleReaction,
    getThreadMessages,
    createTaskFromMessage,
    joinChannel,
    checkChannelAccessMiddleware
} from "../controllers/chat.controller";

const router = Router();

// All chat routes require authentication via protect middleware
router.use(protect);

router.post("/channels/direct", createDirectChannel);
router.post("/channels/group", createGroupChannel);
router.get("/channels", getUserChannels);

router.post("/channels/:id/join", joinChannel);

// Protected routes (require channel access)
router.use("/channels/:id", checkChannelAccessMiddleware);

router.get("/channels/:id/messages", getChannelMessages);
router.post("/channels/:id/read", markChannelAsRead);

router.post("/channels/:id/members", addChannelMembers);
router.delete("/channels/:id/members/:userId", removeChannelMember);

router.patch("/channels/:id/messages/:messageId", editMessage);
router.delete("/channels/:id/messages/:messageId", deleteMessage);
router.post("/channels/:id/messages/:messageId/pin", pinMessage);
router.post("/channels/:id/messages/:messageId/react", toggleReaction);
router.get("/channels/:id/messages/:messageId/thread", getThreadMessages);
router.post("/channels/:id/messages/:messageId/task", createTaskFromMessage);

export default router;
