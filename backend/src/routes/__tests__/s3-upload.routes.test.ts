import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import * as s3UploadService from "../../services/s3-upload.service";

describe("S3 Upload Routes Integration Tests", () => {
    const userId = "a1000000-0000-0000-0000-000000000001";
    const userEmail = "test-upload@test.com";
    const userName = "Upload User";
    const userToken = `mock-user-id-${userId}`;

    const otherUserId = "a1000000-0000-0000-0000-000000000002";
    const otherUserEmail = "other-upload@test.com";
    const otherUserName = "Other User";
    const otherUserToken = `mock-user-id-${otherUserId}`;

    const orgId = "c1000000-0000-0000-0000-000000000001";
    const spaceId = "d1000000-0000-0000-0000-000000000001";

    beforeEach(async () => {
        // Clean rate limits
        await pool.query("DELETE FROM public.rate_limits");
        
        // Seed users
        await seedUser(userId, userEmail, userName);
        await seedUser(otherUserId, otherUserEmail, otherUserName);

        // Seed org and space
        await seedOrg(orgId, "Test Org", userId);
        await seedSpace(spaceId, orgId, "Test Space", userId);

        // Spy on getTaskAttachmentUploadUrl to bypass S3 SDK signing errors in tests
        vi.spyOn(s3UploadService, "getTaskAttachmentUploadUrl").mockImplementation(async (uId, sId, fileName, contentType) => {
            const isMember = await s3UploadService.isSpaceMember(uId, sId);
            if (!isMember) {
                throw new Error("Unauthorized: User is not a member of this space.");
            }
            return {
                uploadUrl: "https://mock-presigned-s3-url.com/upload",
                s3Key: `tasks/${sId}/${uId}/123456789-${fileName || "file"}`
            };
        });
    });

    describe("POST /api/v1/s3-upload/task/upload", () => {
        it("should return 401 when token is missing", async () => {
            await request(app)
                .post("/api/v1/s3-upload/task/upload")
                .send({
                    spaceId,
                    fileName: "test.pdf",
                    contentType: "application/pdf"
                })
                .expect(401);
        });

        it("should return 403 when user is not a member of the space", async () => {
            await request(app)
                .post("/api/v1/s3-upload/task/upload")
                .set("Authorization", `Bearer ${otherUserToken}`)
                .send({
                    spaceId,
                    fileName: "test.pdf",
                    contentType: "application/pdf"
                })
                .expect(403);
        });

        it("should return 200 with presigned URL when user is a space member", async () => {
            const res = await request(app)
                .post("/api/v1/s3-upload/task/upload")
                .set("Authorization", `Bearer ${userToken}`)
                .send({
                    spaceId,
                    fileName: "test.pdf",
                    contentType: "application/pdf"
                })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.data.uploadUrl).toBe("https://mock-presigned-s3-url.com/upload");
            expect(res.body.data.s3Key).toContain(`tasks/${spaceId}/${userId}/`);
        });

        it("should enforce rate limit of 10 requests per minute", async () => {
            // Enable rate limit tests explicitly
            process.env.RATE_LIMIT_TEST = "true";

            try {
                // Send 10 successful requests
                for (let i = 0; i < 10; i++) {
                    await request(app)
                        .post("/api/v1/s3-upload/task/upload")
                        .set("Authorization", `Bearer ${userToken}`)
                        .send({
                            spaceId,
                            fileName: `test-${i}.pdf`,
                            contentType: "application/pdf"
                        })
                        .expect(200);
                }

                // The 11th request should be rate-limited (429)
                const rateLimitedRes = await request(app)
                    .post("/api/v1/s3-upload/task/upload")
                    .set("Authorization", `Bearer ${userToken}`)
                    .send({
                        spaceId,
                        fileName: "test-11.pdf",
                        contentType: "application/pdf"
                    })
                    .expect(429);

                expect(rateLimitedRes.body.success).toBe(false);
                expect(rateLimitedRes.body.message).toContain("Upload limit exceeded");
            } finally {
                // Disable rate limit tests
                delete process.env.RATE_LIMIT_TEST;
            }
        });
    });
});
