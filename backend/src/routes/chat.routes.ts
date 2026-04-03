import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { 
    createDirectChannel, 
    createGroupChannel, 
    getChannels, 
    getChannelMessages, 
    markAsRead 
} from "../controllers/chat.controller";

const router = Router();

router.post("/channels/direct", protect, createDirectChannel);
router.post("/channels/group", protect, createGroupChannel);
router.get("/channels", protect, getChannels);
router.get("/channels/:id/messages", protect, getChannelMessages);
router.post("/channels/:id/read", protect, markAsRead);

export default router;
