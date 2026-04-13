import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import { initSocket } from "./socket";

const port = config.port;

// Start the server
const startServer = async () => {
    try {
        // Test PostgreSQL connection
        await pool.query('SELECT NOW()');

        const server = app.listen(port, () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });

        // Initialize Socket.io
        initSocket(server);
    } catch (error) {
        console.error("Failed to start server:", error);
    }
};

startServer();
