import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as s3UploadController from "../controllers/s3-upload.controller";
import { taskUploadMinRateLimiter, taskUploadDayRateLimiter } from "../middlewares/rate-limiter.middleware";

const router = Router();

// Apply auth middleware to protect all routes
router.use(protect);

// Endpoint to generate presigned PUT URL for chat attachments (private)
router.post("/chat/upload", s3UploadController.getChatAttachmentUploadUrl);

// Endpoint to generate presigned GET URL for chat attachments (private)
router.post("/chat/download", s3UploadController.getChatAttachmentDownloadUrl);

// Endpoint to generate presigned PUT URL for user profile avatars (public)
router.post("/profile/avatar", s3UploadController.getProfileAvatarUploadUrl);

// Endpoint to generate presigned PUT URL for motion page assets (public)
router.post("/motion/asset", s3UploadController.getMotionAssetUploadUrl);

// Endpoints to generate presigned PUT/GET URLs for task context attachments (private)
router.post(
  "/task/upload",
  taskUploadMinRateLimiter,
  taskUploadDayRateLimiter,
  s3UploadController.getTaskAttachmentUploadUrl
);
router.post("/task/download", s3UploadController.getTaskAttachmentDownloadUrl);

export default router;
