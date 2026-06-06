import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { io as Client } from "socket.io-client";
import pool from "../config/pg";
import app from "../app";
import { initSocket } from "../socket";
import { seedUser, seedOrg, seedSpace, seedChannel } from "../test/helpers";

describe("Socket.io Integration Tests", () => {
    let httpServer: http.Server;
    let port: number;

    const mockUserId = "4b277943-7ee4-4c40-9759-9945037d4576";
    const mockUserEmail = "socket-user@keilhq.in";
    const mockUserName = "Socket User";
    const mockToken = `mock-user-id-${mockUserId}`;

    const otherUserId = "4b277943-7ee4-4c40-9759-9945037d4599";
    const otherUserEmail = "socket-other@keilhq.in";
    const otherUserName = "Socket Other User";
    const otherToken = `mock-user-id-${otherUserId}`;

    beforeAll(async () => {
        httpServer = http.createServer(app);
        initSocket(httpServer);

        await new Promise<void>((resolve) => {
            httpServer.listen(0, () => {
                const addr = httpServer.address();
                if (addr && typeof addr === "object") {
                    port = addr.port;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        const { io } = await import("../socket");
        if (io) io.close();
        await new Promise<void>((resolve) => {
            httpServer.close(() => resolve());
        });
    });

    it("should allow a client to connect with a valid auth token", async () => {
        await seedUser(mockUserId, mockUserEmail, mockUserName);

        const socket = Client(`http://localhost:${port}`, {
            auth: { token: mockToken },
            transports: ["websocket"],
        });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                reject(new Error("Connection timed out"));
            }, 5000);

            socket.on("connect", () => {
                clearTimeout(timeout);
                expect(socket.connected).toBe(true);
                socket.disconnect();
                resolve();
            });
            socket.on("connect_error", (err) => {
                clearTimeout(timeout);
                socket.disconnect();
                reject(err);
            });
        });
    });

    it("should reject connection when no auth token is provided", async () => {
        const socket = Client(`http://localhost:${port}`, {
            auth: {},
            transports: ["websocket"],
        });

        await new Promise<void>((resolve) => {
            socket.on("connect", () => {
                socket.disconnect();
                throw new Error("Should not connect without token");
            });
            socket.on("connect_error", (err) => {
                expect(err.message).toContain("Authentication error");
                socket.disconnect();
                resolve();
            });
        });
    });

    it("should handle sending and receiving messages in a room", async () => {
        // Seed all required data
        await seedUser(mockUserId, mockUserEmail, mockUserName);
        const orgId = "b12852ab-d731-4db3-ae7c-2b28c312781a";
        const spaceId = "e57c66ba-a1e6-4252-a50d-ebcb5a3d76e4";
        const channelId = "0f27c6de-6e7e-40dc-84c4-f25cb0647c23";

        await seedOrg(orgId, "Acme Spaces", mockUserId);
        await seedSpace(spaceId, orgId, "Engineering", mockUserId);
        await seedChannel(channelId, orgId, spaceId, "general", mockUserId);

        // Connect client socket
        const socket = Client(`http://localhost:${port}`, {
            auth: { token: mockToken },
            transports: ["websocket"],
        });

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                reject(new Error("Message receive timed out"));
            }, 8000);

            socket.on("connect", () => {
                // Join channel room, then wait briefly for the server to process
                socket.emit("join_channel", { channel_id: channelId });

                // Small delay to ensure join is processed before sending
                setTimeout(() => {
                    socket.emit("send_message", {
                        channel_id: channelId,
                        content: "Hello from the Vitest socket test!",
                    });
                }, 200);
            });

            socket.on("receive_message", (message) => {
                clearTimeout(timeout);
                expect(message).toHaveProperty("id");
                expect(message).toHaveProperty("content", "Hello from the Vitest socket test!");
                expect(message.sender.id).toBe(mockUserId);
                socket.disconnect();
                resolve();
            });

            socket.on("connect_error", (err) => {
                clearTimeout(timeout);
                socket.disconnect();
                reject(err);
            });
        });
    });

    // ── Added Tests: Typing Indicators ──────────────────────────────────────────
    it("should broadcast typing_start and typing_end events to other members in the channel", async () => {
        // 1. Seed two users and a channel
        await seedUser(mockUserId, mockUserEmail, mockUserName);
        await seedUser(otherUserId, otherUserEmail, otherUserName);

        const orgId = "b12852ab-d731-4db3-ae7c-2b28c312781a";
        const spaceId = "e57c66ba-a1e6-4252-a50d-ebcb5a3d76e4";
        const channelId = "0f27c6de-6e7e-40dc-84c4-f25cb0647c99";

        await seedOrg(orgId, "Typing Test Org", mockUserId);
        await seedSpace(spaceId, orgId, "Typing Space", mockUserId);
        await seedChannel(channelId, orgId, spaceId, "typing-fun", mockUserId);

        // Make the other user a space and channel member too
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [orgId, otherUserId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member') ON CONFLICT DO NOTHING`,
            [orgId, spaceId, otherUserId]
        );
        await pool.query(
            `INSERT INTO public.channel_members (channel_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [channelId, otherUserId]
        );

        // 2. Connect both sockets
        const socketA = Client(`http://localhost:${port}`, {
            auth: { token: mockToken },
            transports: ["websocket"],
        });

        const socketB = Client(`http://localhost:${port}`, {
            auth: { token: otherToken },
            transports: ["websocket"],
        });

        // Wait for both to connect first (combats any race conditions)
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                if (socketA.connected) resolve();
                else {
                    socketA.once("connect", () => resolve());
                    socketA.once("connect_error", reject);
                }
            }),
            new Promise<void>((resolve, reject) => {
                if (socketB.connected) resolve();
                else {
                    socketB.once("connect", () => resolve());
                    socketB.once("connect_error", reject);
                }
            })
        ]);

        // Explicitly join the rooms
        socketA.emit("join_channel", { channel_id: channelId });
        socketB.emit("join_channel", { channel_id: channelId });

        // Wait briefly (200ms) to ensure socket.io server registers both joins
        await new Promise((r) => setTimeout(r, 200));

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socketA.disconnect();
                socketB.disconnect();
                reject(new Error("Typing broadcast timed out"));
            }, 8000);

            let typingReceived = false;

            socketB.on("user_typing", (data) => {
                expect(data).toMatchObject({
                    channel_id: channelId,
                    user_id: mockUserId,
                    name: mockUserName,
                });
                typingReceived = true;
                // Emit typing_end from A
                socketA.emit("typing_end", { channel_id: channelId });
            });

            socketB.on("user_stopped_typing", (data) => {
                expect(data).toMatchObject({
                    channel_id: channelId,
                    user_id: mockUserId,
                });
                expect(typingReceived).toBe(true);
                socketA.disconnect();
                socketB.disconnect();
                clearTimeout(timeout);
                resolve();
            });

            // Start typing
            socketA.emit("typing_start", { channel_id: channelId });
        });
    });

    // ── Added Tests: Message Replies ─────────────────────────────────────────────
    it("should broadcast reply_to payload to other members in the channel when replying to a message", async () => {
        await seedUser(mockUserId, mockUserEmail, mockUserName);
        await seedUser(otherUserId, otherUserEmail, otherUserName);

        const orgId = "b12852ab-d731-4db3-ae7c-2b28c312781a";
        const spaceId = "e57c66ba-a1e6-4252-a50d-ebcb5a3d76e4";
        const channelId = "0f27c6de-6e7e-40dc-84c4-f25cb0647c88";

        await seedOrg(orgId, "Reply Socket Org", mockUserId);
        await seedSpace(spaceId, orgId, "Reply Socket Space", mockUserId);
        await seedChannel(channelId, orgId, spaceId, "reply-socket", mockUserId);

        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [orgId, otherUserId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member') ON CONFLICT DO NOTHING`,
            [orgId, spaceId, otherUserId]
        );
        await pool.query(
            `INSERT INTO public.channel_members (channel_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [channelId, otherUserId]
        );

        const socketA = Client(`http://localhost:${port}`, {
            auth: { token: mockToken },
            transports: ["websocket"],
        });

        const socketB = Client(`http://localhost:${port}`, {
            auth: { token: otherToken },
            transports: ["websocket"],
        });

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                if (socketA.connected) resolve();
                else {
                    socketA.once("connect", () => resolve());
                    socketA.once("connect_error", reject);
                }
            }),
            new Promise<void>((resolve, reject) => {
                if (socketB.connected) resolve();
                else {
                    socketB.once("connect", () => resolve());
                    socketB.once("connect_error", reject);
                }
            })
        ]);

        socketA.emit("join_channel", { channel_id: channelId });
        socketB.emit("join_channel", { channel_id: channelId });

        await new Promise((r) => setTimeout(r, 200));

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socketA.disconnect();
                socketB.disconnect();
                reject(new Error("Reply broadcast timed out"));
            }, 8000);

            const replyToPayload = {
                messageId: "mock-message-uuid",
                senderName: "Socket User",
                text: "Original message content"
            };

            socketB.on("receive_message", (message) => {
                expect(message).toHaveProperty("content", "This is a reply message");
                expect(message.reply_to).toEqual(replyToPayload);
                socketA.disconnect();
                socketB.disconnect();
                clearTimeout(timeout);
                resolve();
            });

            socketA.emit("send_message", {
                channel_id: channelId,
                content: "This is a reply message",
                reply_to: replyToPayload
            });
        });
    });

    // ── Added Tests: Room Access Authorization ───────────────────────────────────
    it("should block unauthorized users from joining or sending messages to a channel", async () => {
        // 1. Seed two users: mockUserId is in the channel, otherUserId is NOT in the channel!
        await seedUser(mockUserId, mockUserEmail, mockUserName);
        await seedUser(otherUserId, otherUserEmail, otherUserName);

        const orgId = "b12852ab-d731-4db3-ae7c-2b28c312781a";
        const spaceId = "e57c66ba-a1e6-4252-a50d-ebcb5a3d76e4";
        const channelId = "0f27c6de-6e7e-40dc-84c4-f25cb0647c11";

        await seedOrg(orgId, "Security Test Org", mockUserId);
        await seedSpace(spaceId, orgId, "Security Space", mockUserId);
        await seedChannel(channelId, orgId, spaceId, "secured-chat", mockUserId);

        // Connect the unauthorized user (otherUserId)
        const socketB = Client(`http://localhost:${port}`, {
            auth: { token: otherToken },
            transports: ["websocket"],
        });

        // Connect authorized user to see if they receive anything (they shouldn't!)
        const socketA = Client(`http://localhost:${port}`, {
            auth: { token: mockToken },
            transports: ["websocket"],
        });

        // Wait for both to connect first
        await Promise.all([
            new Promise<void>((resolve, reject) => {
                if (socketA.connected) resolve();
                else {
                    socketA.once("connect", () => resolve());
                    socketA.once("connect_error", reject);
                }
            }),
            new Promise<void>((resolve, reject) => {
                if (socketB.connected) resolve();
                else {
                    socketB.once("connect", () => resolve());
                    socketB.once("connect_error", reject);
                }
            })
        ]);

        await new Promise<void>((resolve, reject) => {
            // If nothing is received within 2 seconds, we assume B was correctly blocked!
            const timeout = setTimeout(async () => {
                // Assert no messages were inserted in DB by the unauthorized user
                const checkDb = await pool.query(
                    `SELECT * FROM public.messages WHERE channel_id = $1 AND sender_id = $2`,
                    [channelId, otherUserId]
                );
                expect(checkDb.rowCount).toBe(0);

                socketA.disconnect();
                socketB.disconnect();
                resolve();
            }, 2000);

            socketA.on("receive_message", () => {
                clearTimeout(timeout);
                socketA.disconnect();
                socketB.disconnect();
                reject(new Error("Authorized user received a message from an unauthorized sender!"));
            });

            // Join rooms (B will be rejected inside server logic)
            socketA.emit("join_channel", { channel_id: channelId });
            socketB.emit("join_channel", { channel_id: channelId });

            setTimeout(() => {
                socketB.emit("send_message", {
                    channel_id: channelId,
                    content: "I am a hacker trying to post here!",
                });
            }, 200);
        });
    });
});
