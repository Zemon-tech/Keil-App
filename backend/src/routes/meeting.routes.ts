import { Router } from "express";
import { protect } from "../middlewares/auth.middleware";
import * as meetingController from "../controllers/meeting.controller";

const router = Router();

// Apply auth middleware to protect all routes
router.use(protect);

// Endpoint to retrieve paginated meeting history for the user
router.get("/history", meetingController.getMeetingHistory);

// Endpoint to search meetings by transcript content
router.get("/search/query", meetingController.searchMeetings);

// Endpoint to generate presigned S3 upload URL
router.post("/upload-url", meetingController.getUploadUrl);

// Endpoint to orchestrate and start a Sarvam STT batch job
router.post("/transcribe", meetingController.transcribeRecording);

// Endpoint to poll transcription status of a Sarvam job
router.get("/transcribe/status", meetingController.getTranscriptionStatus);

// Endpoint to retrieve a single recording for review
router.get("/recording/:recordingId/review", meetingController.getRecordingReview);

// Endpoint to retrieve recordings associated with a specific meeting
router.get("/:meetingId/recordings", meetingController.getMeetingRecordings);

// Endpoint to stop/cancel an active transcription job
router.post("/recording/:recordingId/cancel-transcription", meetingController.cancelTranscription);

// Endpoint to permanently delete a recording and its audio file
router.delete("/recording/:recordingId", meetingController.deleteRecording);

export default router;
