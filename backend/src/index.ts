import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { initSocket } from "./socket";
import { taskOverdueWorkerService } from "./services/task-overdue-worker.service";
import { renewExpiringWatchChannels, healDegradedWatchChannels } from "./services/gcal-watch-renewal.service";
import { NotificationWorkerService } from "./services/notification-worker.service";

const port = Number(config.port);

const server = http.createServer(app);

const startServer = async () => {
    try {
        // Verify PostgreSQL connection before accepting traffic
        await pool.query('SELECT NOW()');

        server.listen(port, '0.0.0.0', () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });

        // Initialize Socket.io (auth middleware + event handlers live in socket.ts)
        initSocket(server);

        // Start background worker for overdue tasks
        taskOverdueWorkerService.start();

        // Start background worker for outbox notifications fanning
        NotificationWorkerService.start();

        // Start Google Calendar watch channel renewal cron (every 12 hours)
        // Renews expiring channels and self-heals degraded integrations
        const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
        setInterval(async () => {
            await renewExpiringWatchChannels().catch(err =>
                console.error('[gcal-renewal] renewExpiringWatchChannels error:', err.message)
            );
            await healDegradedWatchChannels().catch(err =>
                console.error('[gcal-renewal] healDegradedWatchChannels error:', err.message)
            );
        }, TWELVE_HOURS_MS);

        console.log('[gcal-renewal] Watch channel renewal cron scheduled (every 12 hours).');

        // Register Graceful Shutdown Hooks
        const gracefulShutdown = (signal: string) => {
            console.log(`🛑 [server]: Received ${signal}. Shutting down gracefully...`);
            NotificationWorkerService.stop();
            taskOverdueWorkerService.stop();
            server.close(() => {
                pool.end().then(() => {
                    console.log("🔌 [server]: Database connection pool ended cleanly.");
                    process.exit(0);
                });
            });
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
