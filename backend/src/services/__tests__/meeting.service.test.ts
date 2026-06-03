import { describe, it, expect, beforeEach } from "vitest";
import * as meetingService from "../meeting.service";
import pool from "../../config/pg";
import { seedUser } from "../../test/helpers";

describe("Meeting Service Unit Tests", () => {
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "meeting-service-a@test.com";
    const userAName = "User A";

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "meeting-service-b@test.com";
    const userBName = "User B";

    beforeEach(async () => {
        await seedUser(userAId, userAEmail, userAName);
        await seedUser(userBId, userBEmail, userBName);
    });

    // ── Delete guards ────────────────────────────────────────────────────────────
    describe("deleteRecording guards", () => {
        it("should permanently delete a recording and return true when called by the owner", async () => {
            // 1. Create a recording for User A
            const recording = await meetingService.createRecording(
                userAId,
                null,
                "meetings/own-rec.webm"
            );

            // 2. Delete the recording as User A -> should succeed and return true
            const result = await meetingService.deleteRecording(recording.id, userAId);
            expect(result).toBe(true);

            // 3. Verify it is gone from the database
            const check = await meetingService.getRecordingById(recording.id);
            expect(check).toBeNull();
        });

        it("should block deletion and return false when called by a non-owner", async () => {
            // 1. Create a recording for User A
            const recording = await meetingService.createRecording(
                userAId,
                null,
                "meetings/other-rec.webm"
            );

            // 2. Try to delete as User B -> should fail and return false
            const result = await meetingService.deleteRecording(recording.id, userBId);
            expect(result).toBe(false);

            // 3. Verify it still exists in the database
            const check = await meetingService.getRecordingById(recording.id);
            expect(check).not.toBeNull();
            expect(check?.id).toBe(recording.id);
        });
    });

    // ── Float Duration Rounding ──────────────────────────────────────────────────
    describe("audio duration rounding of floats", () => {
        it("should round float audio durations to the nearest integer in updateRecordingJob", async () => {
            // 1. Create a pending recording
            const recording = await meetingService.createRecording(
                userAId,
                null,
                "meetings/float-rec.webm"
            );

            // 2. Update with float duration of 15.6 seconds -> should round to 16
            const updatedHigh = await meetingService.updateRecordingJob(
                recording.id,
                "job-high-123",
                15.6
            );
            expect(updatedHigh.audio_duration_seconds).toBe(16);

            // 3. Update with float duration of 15.3 seconds -> should round to 15
            const updatedLow = await meetingService.updateRecordingJob(
                recording.id,
                "job-low-123",
                15.3
            );
            expect(updatedLow.audio_duration_seconds).toBe(15);
        });

        it("should round float audio durations to the nearest integer in updateRecordingDuration", async () => {
            // 1. Create a pending recording
            const recording = await meetingService.createRecording(
                userAId,
                null,
                "meetings/duration-float-rec.webm"
            );

            // 2. Update duration with float of 42.7 -> should round to 43
            const updatedHigh = await meetingService.updateRecordingDuration(recording.id, 42.7);
            expect(updatedHigh.audio_duration_seconds).toBe(43);

            // 3. Update duration with float of 42.4 -> should round to 42
            const updatedLow = await meetingService.updateRecordingDuration(recording.id, 42.4);
            expect(updatedLow.audio_duration_seconds).toBe(42);
        });
    });
});
