import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser } from "../../test/helpers";

describe("Meeting Routes Integration Tests", () => {
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "meeting-user-a@test.com";
    const userAName = "User A";
    const userAToken = `mock-user-id-${userAId}`;

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "meeting-user-b@test.com";
    const userBName = "User B";
    const userBToken = `mock-user-id-${userBId}`;

    beforeEach(async () => {
        // Seed users A and B
        await seedUser(userAId, userAEmail, userAName);
        await seedUser(userBId, userBEmail, userBName);
    });

    // ── Paginated Meeting History ────────────────────────────────────────────────
    describe("GET /api/v1/meetings/history - Paginated history", () => {
        it("should return paginated list of recordings for the authenticated user", async () => {
            // Seed 3 recordings for User A
            await pool.query(
                `INSERT INTO public.meeting_recordings (id, user_id, audio_s3_key, transcription_status)
                 VALUES 
                 ('d1000000-0000-0000-0000-000000000001', $1, 'meetings/rec1.webm', 'completed'),
                 ('d1000000-0000-0000-0000-000000000002', $1, 'meetings/rec2.webm', 'processing'),
                 ('d1000000-0000-0000-0000-000000000003', $1, 'meetings/rec3.webm', 'pending')`,
                [userAId]
            );

            // Fetch first page with limit=2
            const resPage1 = await request(app)
                .get("/api/v1/meetings/history?page=1&limit=2")
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(resPage1.body.success).toBe(true);
            expect(resPage1.body.data.recordings.length).toBe(2);
            expect(resPage1.body.data.pagination).toEqual({
                page: 1,
                limit: 2,
                total: 3,
                hasMore: true
            });

            // Fetch second page with limit=2
            const resPage2 = await request(app)
                .get("/api/v1/meetings/history?page=2&limit=2")
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(resPage2.body.data.recordings.length).toBe(1);
            expect(resPage2.body.data.pagination.hasMore).toBe(false);
        });
    });

    // ── Transcript Search ────────────────────────────────────────────────────────
    describe("GET /api/v1/meetings/search/query - Search transcript content", () => {
        it("should search and filter user's meetings by transcript text", async () => {
            // Seed recordings with different transcripts
            await pool.query(
                `INSERT INTO public.meeting_recordings (id, user_id, audio_s3_key, transcript_text)
                 VALUES 
                 ('d1000000-0000-0000-0000-000000000011', $1, 'rec1.webm', 'Let us discuss the database migrations next Tuesday'),
                 ('d1000000-0000-0000-0000-000000000012', $1, 'rec2.webm', 'We should write comprehensive unit tests'),
                 ('d1000000-0000-0000-0000-000000000013', $2, 'rec3.webm', 'Another user talks about database migrations too')`,
                [userAId, userBId]
            );

            // Search for "database" as User A
            const res = await request(app)
                .get("/api/v1/meetings/search/query?q=database")
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            // Should find only User A's matching recording, ignoring User B's even if it matches
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0].id).toBe("d1000000-0000-0000-0000-000000000011");
            expect(res.body.data[0].transcript_text).toContain("database migrations");
        });

        it("should return 400 if search query parameter 'q' is missing or empty", async () => {
            await request(app)
                .get("/api/v1/meetings/search/query?q=")
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(400);

            await request(app)
                .get("/api/v1/meetings/search/query")
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(400);
        });
    });

    // ── Block Deleting Recordings Owned by Other Users ─────────────────────────
    describe("DELETE /api/v1/meetings/recording/:recordingId - Deletion guards", () => {
        it("should allow a user to delete their own recording", async () => {
            // Seed a recording for User A
            const recId = "d1000000-0000-0000-0000-000000000021";
            await pool.query(
                `INSERT INTO public.meeting_recordings (id, user_id, audio_s3_key, transcription_status)
                 VALUES ($1, $2, 'meetings/own-rec.webm', 'completed')`,
                [recId, userAId]
            );

            // User A deletes their own recording
            await request(app)
                .delete(`/api/v1/meetings/recording/${recId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            // Verify deleted from DB
            const check = await pool.query("SELECT 1 FROM public.meeting_recordings WHERE id = $1", [recId]);
            expect(check.rowCount).toBe(0);
        });

        it("should block a user from deleting another user's recording", async () => {
            // Seed a recording for User A
            const recId = "d1000000-0000-0000-0000-000000000022";
            await pool.query(
                `INSERT INTO public.meeting_recordings (id, user_id, audio_s3_key, transcription_status)
                 VALUES ($1, $2, 'meetings/other-rec.webm', 'completed')`,
                [recId, userAId]
            );

            // User B tries to delete User A's recording -> should return 403
            await request(app)
                .delete(`/api/v1/meetings/recording/${recId}`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(403);

            // Verify still exists in DB
            const check = await pool.query("SELECT 1 FROM public.meeting_recordings WHERE id = $1", [recId]);
            expect(check.rowCount).toBe(1);
        });
    });
});
