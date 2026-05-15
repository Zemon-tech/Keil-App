import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { initSocket } from "./socket";
import { taskOverdueWorkerService } from "./services/task-overdue-worker.service";

const port = Number(config.port);

const server = http.createServer(app);

const startServer = async () => {
    try {
        // Verify PostgreSQL connection before accepting traffic
        await pool.query('SELECT NOW()');

        server.listen(5001, '0.0.0.0', () => {
            console.log(`⚡️[server]: Server is running at http://localhost:5001`);
        });

        // Initialize Socket.io (auth middleware + event handlers live in socket.ts)
        initSocket(server);

        // Start background worker for overdue tasks
        taskOverdueWorkerService.start();
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();

// Trigger nodemon restart
