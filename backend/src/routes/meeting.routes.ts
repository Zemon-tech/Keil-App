import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as meetingController from "../controllers/meeting.controller";

const router = Router();

// Apply auth middleware to protect all routes
router.use(protect);

// Endpoint to generate presigned S3 upload URL
router.post("/upload-url", meetingController.getUploadUrl);

// Endpoint to orchestrate and start a Sarvam STT batch job
router.post("/transcribe", meetingController.transcribeRecording);

// Endpoint to poll transcription status of a Sarvam job
router.get("/transcribe/status", meetingController.getTranscriptionStatus);

// Endpoint to retrieve recordings associated with a specific meeting
router.get("/:meetingId/recordings", meetingController.getMeetingRecordings);

export default router;
