import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { Server } from "socket.io";
import { supabaseAdmin } from "./config/supabase";

const port = config.port;

const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
    cors: {
        origin: "*", // Adjust appropriately for production
    }
});

// Socket Authentication Middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("Authentication error: No token provided"));
        }

        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        
        if (error || !user) {
            return next(new Error("Authentication error: Invalid or expired token"));
        }

        // Fetch workspaceId using the user's ID
        const workspaceResult = await pool.query(
            'SELECT workspace_id FROM public.workspace_members WHERE user_id = $1 LIMIT 1',
            [user.id]
        );

        socket.data.userId = user.id;
        if (workspaceResult.rows.length > 0) {
            socket.data.workspaceId = workspaceResult.rows[0].workspace_id;
        }

        next();
    } catch (err) {
        console.error("Socket authentication error:", err);
        next(new Error("Internal Server Error during Socket authentication"));
    }
});

// Socket workflow events
io.on("connection", async (socket) => {
    const userId = socket.data.userId;
    const workspaceId = socket.data.workspaceId;

    if (!userId || !workspaceId) return socket.disconnect();

    try {
        // [x] Auto-join private user room
        socket.join("user:" + userId);

        // [x] Auto-query and join valid channels
        const userChannelsResult = await pool.query(
            "SELECT channel_id FROM channel_members cm JOIN channels c ON c.id = cm.channel_id WHERE cm.user_id = $1 AND c.workspace_id = $2", 
            [userId, workspaceId]
        );
        userChannelsResult.rows.forEach(row => socket.join(row.channel_id));

        socket.on("send_message", async (data, callback) => {
            try {
                const { channel_id, content } = data;
                if (!channel_id || !content) {
                    if (callback) callback({ success: false, error: "Missing fields" });
                    return;
                }

                // [x] Validate membership
                const membershipCheck = await pool.query(
                    "SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2",
                    [channel_id, userId]
                );
                if (membershipCheck.rows.length === 0) {
                     if (callback) callback({ success: false, error: "Unauthorized" });
                     return;
                }

                // [x] Save strictly to DB
                const insertMsg = await pool.query(
                    "INSERT INTO messages (channel_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *",
                    [channel_id, userId, content]
                );
                const msg = insertMsg.rows[0];

                // [x] Sender Red-Dot Fix
                await pool.query(
                    "UPDATE channel_members SET last_read_at = NOW() WHERE channel_id = $1 AND user_id = $2",
                    [channel_id, userId]
                );

                const senderDetails = await pool.query("SELECT id, name FROM users WHERE id = $1", [userId]);
                const payload = { ...msg, sender: senderDetails.rows[0] };

                // [x] Broadcast
                io.to(channel_id).emit("receive_message", payload);

                if (callback) callback({ success: true, data: payload });

            } catch (err: any) {
                 console.error("Socket error on send_message:", err.message);
                 if (callback) callback({ success: false, error: "Internal Error" });
            }
        });
    } catch (err) {
        console.error("Socket connection fail:", err);
    }
});

// Start the server
const startServer = async () => {
    try {
        // Test PostgreSQL connection
        await pool.query('SELECT NOW()');

        server.listen(port, () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
