import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import { requireRecordingQuota, recordRecordingQuota } from "../middlewares/usage-limit.middleware";
import * as meetingController from "../controllers/meeting.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(protect);

// Endpoint to retrieve paginated meeting history for the user
router.get("/history", meetingController.getMeetingHistory);

// Endpoint to search meetings by transcript content
router.get("/search/query", meetingController.searchMeetings);

// Endpoint to generate presigned S3 upload URL (recording quota enforced)
router.post("/upload-url", requireRecordingQuota, meetingController.getUploadUrl);

// Endpoint to start a transcription job via ElevenLabs
router.post("/transcribe", recordRecordingQuota, meetingController.transcribeRecording);

// Endpoint to poll transcription status
router.get("/transcribe/status", meetingController.getTranscriptionStatus);

// Endpoint to retrieve a single recording for review
router.get("/recording/:recordingId/review", meetingController.getRecordingReview);

// Endpoint to retrieve recordings associated with a specific meeting
router.get("/:meetingId/recordings", meetingController.getMeetingRecordings);

// Endpoint to stop/cancel an active transcription job
router.post("/recording/:recordingId/cancel-transcription", meetingController.cancelTranscription);

// Endpoint to save a meeting summary to Motion (and Notion when connected)
router.post("/recording/:recordingId/save-to-motion", meetingController.saveRecordingToMotion);

// Endpoint to permanently delete a recording and its audio file
router.delete("/recording/:recordingId", meetingController.deleteRecording);

export default router;
