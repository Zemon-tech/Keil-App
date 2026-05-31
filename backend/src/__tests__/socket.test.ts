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
});
