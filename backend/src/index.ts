import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { initSocket } from "./socket";

const port = config.port;

const server = http.createServer(app);

const startServer = async () => {
    try {
        // Verify PostgreSQL connection before accepting traffic
        await pool.query('SELECT NOW()');

        server.listen(port, () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });

        // Initialize Socket.io (auth middleware + event handlers live in socket.ts)
        initSocket(server);
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

// Trigger nodemon restart
