import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences
} from "../controllers/notification.controller";

const router = Router();

router.use(protect);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markAsRead);
router.post("/read-all", markAllAsRead);
router.delete("/clear-all", clearAllNotifications);
router.get("/preferences", getNotificationPreferences);
router.patch("/preferences", updateNotificationPreferences);

export default router;
