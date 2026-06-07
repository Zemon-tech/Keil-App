import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import * as orgChatService from "../../services/org-chat.service";

describe("Org Chat Routes Integration Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "user-a@test.com";
    const userAName = "User A";
    const userAToken = `mock-user-id-${userAId}`;

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "user-b@test.com";
    const userBName = "User B";
    const userBToken = `mock-user-id-${userBId}`;

    const nonSpaceUserId = "a1000000-0000-0000-0000-000000000099";
    const nonSpaceUserEmail = "non-space@test.com";
    const nonSpaceUserName = "Non Space User";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";

    const basePath = `/api/v1/orgs/${orgId}/spaces/${spaceId}/chat`;

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
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, userBId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member')
             ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'member'`,
             [orgId, spaceId, userBId]
        );

        // Note: nonSpaceUserId is NOT added to the space members!
    });

    // ── Direct Channel Creation & Reuse ──────────────────────────────────────────
    describe("POST /channels/direct - DM Channel", () => {
        it("should create a direct channel and reuse it if created again", async () => {
            // 1. Create DM channel between User A and User B
            const createRes = await request(app)
                .post(`${basePath}/channels/direct`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({ target_user_id: userBId })
                .expect(201);

            expect(createRes.body.success).toBe(true);
            expect(createRes.body.data.channel).toMatchObject({
                type: "direct",
                org_id: orgId,
                space_id: spaceId,
            });
            expect(createRes.body.data.channel.id).toBeDefined();
            const channelId = createRes.body.data.channel.id;

            // 2. Try to create the DM channel again -> should reuse the existing one and return 200
            const reuseRes = await request(app)
                .post(`${basePath}/channels/direct`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({ target_user_id: userBId })
                .expect(200);

            expect(reuseRes.body.success).toBe(true);
            expect(reuseRes.body.data.channel.id).toBe(channelId);
        });
    });

    // ── Group Channel Creation Boundaries ────────────────────────────────────────
    describe("POST /channels/group - Group Channel Space Check", () => {
        it("should create a group channel successfully with space members", async () => {
            const res = await request(app)
                .post(`${basePath}/channels/group`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    name: "Engineering Group",
                    member_ids: [userBId]
                })
                .expect(201);

            expect(res.body.success).toBe(true);
            expect(res.body.data.channel.name).toBe("Engineering Group");
            expect(res.body.data.channel.type).toBe("group");
        });

        it("should reject group channel creation if any member is not part of the space", async () => {
            const res = await request(app)
                .post(`${basePath}/channels/group`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    name: "Hacked Group",
                    member_ids: [userBId, nonSpaceUserId] // nonSpaceUserId is not in the space!
                })
                .expect(400);

            expect(res.body.message).toContain("belong to the active space");
        });
    });

    // ── Channel Indexing, Unread Counts, Pagination & Read Status ──────────────────
    describe("Channel Indexing and unread counts", () => {
        it("should compute unread counts correctly, paginate messages, and clear unread counts on mark as read", async () => {
            // 1. Create a group channel
            const channelRes = await request(app)
                .post(`${basePath}/channels/group`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    name: "Test Group",
                    member_ids: [userBId]
                })
                .expect(201);

            const channelId = channelRes.body.data.channel.id;

            // 2. User A sends 3 messages into the channel
            await orgChatService.saveMessage(channelId, userAId, "Message 1");
            await orgChatService.saveMessage(channelId, userAId, "Message 2");
            const lastMsg = await orgChatService.saveMessage(channelId, userAId, "Message 3");

            // 3. User B retrieves their channels list -> unread_count should be 3
            const listRes = await request(app)
                .get(`${basePath}/channels`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            const channel = listRes.body.data.channels.find((c: any) => c.id === channelId);
            expect(channel).toBeDefined();
            expect(channel.unread_count).toBe(3);

            // 4. User B retrieves channel messages with pagination
            // Let's ask for limit = 2
            const messagesRes = await request(app)
                .get(`${basePath}/channels/${channelId}/messages?limit=2`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            expect(messagesRes.body.success).toBe(true);
            expect(messagesRes.body.data.messages.length).toBe(2);
            // In DESC pagination order, we get the latest messages
            expect(messagesRes.body.data.messages[1].content).toBe("Message 3");
            expect(messagesRes.body.data.messages[0].content).toBe("Message 2");

            // Paginated fetch: fetch before last message ID
            const prevMessagesRes = await request(app)
                .get(`${basePath}/channels/${channelId}/messages?limit=2&before_id=${lastMsg.id}`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            expect(prevMessagesRes.body.data.messages.length).toBe(2);
            expect(prevMessagesRes.body.data.messages[1].content).toBe("Message 2");
            expect(prevMessagesRes.body.data.messages[0].content).toBe("Message 1");

            // 5. User B marks the channel as read -> should return 200
            await request(app)
                .post(`${basePath}/channels/${channelId}/read`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            // 6. User B retrieves their channels list again -> unread_count should be 0
            const listAfterReadRes = await request(app)
                .get(`${basePath}/channels`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            const channelAfterRead = listAfterReadRes.body.data.channels.find((c: any) => c.id === channelId);
            expect(channelAfterRead.unread_count).toBe(0);
        });
    });

    // ── DM Privacy: Third-party access block ──────────────────────────────────────
    describe("GET /channels/:id/messages - DM Privacy (User C blocked)", () => {
        it("should return 403 when User C tries to read messages from a private DM between User A and User B", async () => {
            const userCId = "a1000000-0000-0000-0000-000000000003";
            const userCEmail = "user-c@test.com";
            const userCName = "User C";
            const userCToken = `mock-user-id-${userCId}`;

            // Seed User C and add them to the org and space (they are a legitimate space member)
            await seedUser(userCId, userCEmail, userCName);
            await pool.query(
                `INSERT INTO public.organisation_members (org_id, user_id, role)
                 VALUES ($1, $2, 'member')
                 ON CONFLICT (org_id, user_id) DO NOTHING`,
                [orgId, userCId]
            );
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'member')
                 ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'member'`,
                [orgId, spaceId, userCId]
            );

            // 1. Create a DM channel between User A and User B
            const dmRes = await request(app)
                .post(`${basePath}/channels/direct`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({ target_user_id: userBId })
                .expect(201);

            const dmChannelId = dmRes.body.data.channel.id;
            expect(dmChannelId).toBeDefined();

            // 2. User A sends a message into the DM
            await orgChatService.saveMessage(dmChannelId, userAId, "Secret message between A and B");

            // 3. User C (NOT a member of this DM) tries to read its messages -> 403 Forbidden
            const res = await request(app)
                .get(`${basePath}/channels/${dmChannelId}/messages`)
                .set("Authorization", `Bearer ${userCToken}`)
                .expect(403);

            expect(res.body.message).toContain("Not a member of this channel");

            // 4. Confirm User A (a member) CAN read the messages -> 200 OK
            const validRes = await request(app)
                .get(`${basePath}/channels/${dmChannelId}/messages`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(validRes.body.success).toBe(true);
            expect(validRes.body.data.messages.length).toBeGreaterThanOrEqual(1);
            expect(validRes.body.data.messages[0].content).toBe("Secret message between A and B");
        });
    });
});
