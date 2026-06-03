import { describe, it, expect, beforeEach } from "vitest";
import * as orgChatService from "../org-chat.service";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import { ApiError } from "../../utils/ApiError";

describe("Org Chat Service Unit Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "user-a@test.com";
    const userAName = "User A";

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "user-b@test.com";
    const userBName = "User B";

    const nonSpaceUserId = "a1000000-0000-0000-0000-000000000099";
    const nonSpaceUserEmail = "non-space@test.com";
    const nonSpaceUserName = "Non Space User";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";

    beforeEach(async () => {
        // Seed users
        await seedUser(userAId, userAEmail, userAName);
        await seedUser(userBId, userBEmail, userBName);
        await seedUser(nonSpaceUserId, nonSpaceUserEmail, nonSpaceUserName);

        // Seed org + space
        await seedOrg(orgId, "Chat Test Org", userAId);
        await seedSpace(spaceId, orgId, "Chat Space", userAId);

        // Ensure userA and userB are space members
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, userBId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member') ON CONFLICT (space_id, user_id) DO NOTHING`,
            [orgId, spaceId, userBId]
        );

        // Note: nonSpaceUserId is NOT added to space_members!
    });

    // ── createChannel Membership Validation ──────────────────────────────────────
    describe("createChannel - Space Membership Validation", () => {
        it("should successfully create a channel if all members belong to the space", async () => {
            const channelId = await orgChatService.createChannel(
                orgId,
                spaceId,
                "group",
                "Dev Group",
                [userAId, userBId],
                userAId
            );

            expect(channelId).toBeDefined();

            // Verify members were inserted
            const members = await orgChatService.getChannelMemberIds(channelId);
            expect(members).toContain(userAId);
            expect(members).toContain(userBId);
        });

        it("should throw ApiError if any channel member is not part of the active space", async () => {
            await expect(
                orgChatService.createChannel(
                    orgId,
                    spaceId,
                    "group",
                    "Invalid Group",
                    [userAId, nonSpaceUserId], // nonSpaceUserId is not in the space!
                    userAId
                )
            ).rejects.toThrowError(
                new ApiError(400, "All channel members must belong to the active space")
            );
        });
    });

    // ── saveMessage Marks Sender as Read ──────────────────────────────────────────
    describe("saveMessage - Automatic Read Update for Sender", () => {
        it("should save the message and automatically update last_read_at for the sender", async () => {
            const channelId = await orgChatService.createChannel(
                orgId,
                spaceId,
                "direct",
                null,
                [userAId, userBId]
            );

            // Nullify/backdate last_read_at to verify it gets updated
            await pool.query(
                `UPDATE public.channel_members 
                 SET last_read_at = NOW() - INTERVAL '1 hour'
                 WHERE channel_id = $1 AND user_id = $2`,
                [channelId, userAId]
            );

            // Send a message as User A
            const message = await orgChatService.saveMessage(channelId, userAId, "Hello world!");
            expect(message.content).toBe("Hello world!");

            // Verify User A's last_read_at has been updated to approximately NOW
            const res = await pool.query(
                `SELECT last_read_at FROM public.channel_members 
                 WHERE channel_id = $1 AND user_id = $2`,
                [channelId, userAId]
            );
            const lastRead = new Date(res.rows[0].last_read_at).getTime();
            const now = Date.now();

            // Difference should be extremely small (less than 10 seconds)
            expect(Math.abs(now - lastRead)).toBeLessThan(10000);
        });
    });

    // ── Cursor-Based Pagination with beforeId ────────────────────────────────────
    describe("getChannelMessages - Cursor-Based Pagination (beforeId)", () => {
        it("should return correct page of messages relative to beforeId cursor", async () => {
            const channelId = await orgChatService.createChannel(
                orgId,
                spaceId,
                "group",
                "Pagination Group",
                [userAId, userBId],
                userAId
            );

            // Seed 3 messages sequentially (with explicit delay to ensure different timestamps if needed,
            // though Vitest runs fast and primary keys / serial timestamps handle sorting too)
            const m1 = await orgChatService.saveMessage(channelId, userAId, "First Message");
            await new Promise((r) => setTimeout(r, 10)); // tiny delay
            const m2 = await orgChatService.saveMessage(channelId, userAId, "Second Message");
            await new Promise((r) => setTimeout(r, 10));
            const m3 = await orgChatService.saveMessage(channelId, userAId, "Third Message");

            // Fetch first page (limit = 2) -> should return latest 2 messages in chronological order: ["Second Message", "Third Message"]
            const firstPage = await orgChatService.getChannelMessages(channelId, 2);
            expect(firstPage.length).toBe(2);
            expect(firstPage[0].content).toBe("Second Message");
            expect(firstPage[0].id).toBe(m2.id);
            expect(firstPage[1].content).toBe("Third Message");
            expect(firstPage[1].id).toBe(m3.id);

            // Fetch second page (limit = 2, beforeId = m3.id) -> should return older messages before m3: ["First Message", "Second Message"]
            const secondPage = await orgChatService.getChannelMessages(channelId, 2, m3.id);
            expect(secondPage.length).toBe(2);
            expect(secondPage[0].content).toBe("First Message");
            expect(secondPage[0].id).toBe(m1.id);
            expect(secondPage[1].content).toBe("Second Message");
            expect(secondPage[1].id).toBe(m2.id);

            // Fetch with beforeId = m2.id -> should return ["First Message"] (only 1 remains)
            const thirdPage = await orgChatService.getChannelMessages(channelId, 2, m2.id);
            expect(thirdPage.length).toBe(1);
            expect(thirdPage[0].content).toBe("First Message");
            expect(thirdPage[0].id).toBe(m1.id);
        });
    });
});
