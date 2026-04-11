import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { supabaseAdmin } from "./config/supabase";
import pool from "./config/pg";
import { chatService } from "./services/chat.service";

export let io: SocketIOServer;

export const initSocket = (server: HttpServer) => {
    io = new SocketIOServer(server, {
        cors: {
            origin: "*", // Adjust for production
            methods: ["GET", "POST"]
        }
    });

    // Authentication middleware
    io.use(async (socket, next) => {
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
        console.log(`🔌 [socket]: User connected: ${user.id}`);

        // Join personal room
        socket.join(`user:${user.id}`);

        // Fetch all channels user belongs to and join them
        try {
            const result = await pool.query('SELECT channel_id FROM channel_members WHERE user_id = $1', [user.id]);
            result.rows.forEach(row => {
                socket.join(`channel:${row.channel_id}`);
            });
            console.log(`🔌 [socket]: User ${user.id} joined ${result.rows.length} channels`);
        } catch (err) {
            console.error(`❌ [socket]: Error joining channel rooms for user ${user.id}`, err);
        }

        socket.on("send_message", async (payload: { channel_id: string; content: string }) => {
            try {
                const { channel_id, content } = payload;
                if (!channel_id || !content) return;

                // Verify user is in channel
                const check = await pool.query('SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2', [channel_id, user.id]);
                if (check.rowCount === 0) return; // Not authorized

                // Save message
                const message = await chatService.saveMessage(channel_id, user.id, content);

                // Broadcast strictly inside the channel_id socket room
                io.to(`channel:${channel_id}`).emit("receive_message", message);
            } catch (err) {
                console.error(`❌ [socket]: Error handling send_message`, err);
            }
        });

        // Typing indicators
        socket.on("typing_start", (payload: { channel_id: string }) => {
            if (payload.channel_id) {
                // broadcast to everyone else in the room
                socket.to(`channel:${payload.channel_id}`).emit("user_typing", { 
                    channel_id: payload.channel_id, 
                    user_id: user.id, 
                    name: user.name || user.email 
                });
            }
        });

        socket.on("typing_end", (payload: { channel_id: string }) => {
            if (payload.channel_id) {
                socket.to(`channel:${payload.channel_id}`).emit("user_stopped_typing", { 
                    channel_id: payload.channel_id, 
                    user_id: user.id 
                });
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 [socket]: User disconnected: ${user.id}`);
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
