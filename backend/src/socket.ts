import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { supabaseAdmin } from "./config/supabase";
import pool from "./config/pg";
import * as orgChatService from "./services/org-chat.service";
import { config } from "./config";
import { createServiceLogger } from "./lib/logger";

const log = createServiceLogger("socket");

export let io: SocketIOServer;

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3000",
    config.frontendUrl,
].filter((origin): origin is string => Boolean(origin));

export const initSocket = (server: HttpServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true,
        }
    });

    // Authentication middleware
    io.use(async (socket: Socket, next: (err?: Error) => void) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error("Authentication error: No token provided"));
            }

            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
            if (error || !user) {
                return next(new Error("Authentication error: Invalid token"));
            }

            // Fetch user
            const result = await pool.query('SELECT * FROM public.users WHERE id = $1', [user.id]);
            if (result.rows.length === 0) {
                return next(new Error("Authentication error: User not found in DB"));
            }

            (socket as any).user = result.rows[0];
            next();
        } catch (err) {
            next(new Error("Authentication error: Internal error"));
        }
    });

    io.on("connection", async (socket: Socket) => {
        const user = (socket as any).user;
        log.info({ userId: user.id }, "User connected");

        // Join personal room
        socket.join(`user:${user.id}`);

        const isChannelMember = async (channelId: string): Promise<boolean> => {
            if (socket.rooms.has(`channel:${channelId}`)) {
                return true;
            }
            const result = await pool.query(
                'SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2 LIMIT 1',
                [channelId, user.id]
            );
            return (result.rowCount ?? 0) > 0;
        };

        // Fetch all channels user belongs to and join them
        try {
            const result = await pool.query('SELECT channel_id FROM channel_members WHERE user_id = $1', [user.id]);
            result.rows.forEach((row: any) => {
                socket.join(`channel:${row.channel_id}`);
            });
            
            // Join space rooms
            const spacesResult = await pool.query('SELECT space_id FROM space_members WHERE user_id = $1', [user.id]);
            spacesResult.rows.forEach((row: any) => {
                socket.join(`space:${row.space_id}`);
            });

            log.info({ userId: user.id, channels: result.rows.length, spaces: spacesResult.rows.length }, "User joined rooms");
        } catch (err) {
            log.error({ err, userId: user.id }, "Error joining rooms");
        }

        socket.on("send_message", async (payload: { channel_id: string; content: string; reply_to?: any }) => {
            try {
                const { channel_id, content, reply_to } = payload;
                if (!channel_id || !content) return;

                // Verify user is in channel
                if (!(await isChannelMember(channel_id))) return;

                // Save message
                const message = await orgChatService.saveMessage(channel_id, user.id, content, reply_to);

                // Broadcast strictly inside the channel_id socket room
                io.to(`channel:${channel_id}`).emit("receive_message", message);
            } catch (err) {
                log.error({ err, userId: user.id }, "Error handling send_message");
            }
        });

        // Typing indicators
        socket.on("typing_start", async (payload: { channel_id: string }) => {
            if (payload.channel_id && await isChannelMember(payload.channel_id)) {
                // broadcast to everyone else in the room
                socket.to(`channel:${payload.channel_id}`).emit("user_typing", { 
                    channel_id: payload.channel_id, 
                    user_id: user.id, 
                    name: user.name || user.email 
                });
            }
        });

        socket.on("typing_end", async (payload: { channel_id: string }) => {
            if (payload.channel_id && await isChannelMember(payload.channel_id)) {
                socket.to(`channel:${payload.channel_id}`).emit("user_stopped_typing", { 
                    channel_id: payload.channel_id, 
                    user_id: user.id 
                });
            }
        });

        socket.on("join_channel", async (payload: { channel_id: string }) => {
            if (payload.channel_id && await isChannelMember(payload.channel_id)) {
                socket.join(`channel:${payload.channel_id}`);
            }
        });

        socket.on("join_org_rooms", async (payload: { orgId: string }) => {
            try {
                const { orgId } = payload;
                if (!orgId) return;

                // 1. Verify user is a member of this organization
                const orgMemberResult = await pool.query(
                    'SELECT 1 FROM organisation_members WHERE org_id = $1 AND user_id = $2 LIMIT 1',
                    [orgId, user.id]
                );
                if (orgMemberResult.rowCount === 0) return;

                // 2. Query all spaces the user belongs to in this organization and join them
                const spacesResult = await pool.query(
                    'SELECT space_id FROM space_members WHERE org_id = $1 AND user_id = $2',
                    [orgId, user.id]
                );
                spacesResult.rows.forEach((row: any) => {
                    socket.join(`space:${row.space_id}`);
                });

                // 3. Query all channels the user belongs to in this organization and join them
                const channelsResult = await pool.query(
                    `SELECT cm.channel_id FROM channel_members cm
                     INNER JOIN channels c ON c.id = cm.channel_id
                     WHERE c.org_id = $1 AND cm.user_id = $2`,
                    [orgId, user.id]
                );
                channelsResult.rows.forEach((row: any) => {
                    socket.join(`channel:${row.channel_id}`);
                });

                log.info({ userId: user.id, orgId, spacesJoined: spacesResult.rows.length, channelsJoined: channelsResult.rows.length }, "User dynamically joined rooms for organisation");
            } catch (err) {
                log.error({ err, userId: user.id, orgId: payload?.orgId }, "Error handling join_org_rooms");
            }
        });

        socket.on("disconnect", () => {
            log.info({ userId: user.id }, "User disconnected");
        });
    });

    return io;
};

// Export fn to manually trigger channel_added event
export const broadcastNewChannel = (memberIds: string[], channel: any) => {
    if (!io) return;
    memberIds.forEach(id => {
        io.to(`user:${id}`).emit("channel_added", channel);
    });
};

export const broadcastMotionChange = (spaceId: string, payload: { type: string, pageId?: string, page?: any, userId?: string }) => {
    if (!io) return;
    io.to(`space:${spaceId}`).emit("motion_change", payload);
};

export const broadcastMeetingUpdate = (userId: string, payload: { type: string; recordingId: string; status: string; recording?: any }) => {
    if (!io) return;
    io.to(`user:${userId}`).emit("meeting_update", payload);
};
