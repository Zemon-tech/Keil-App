import dotenv from "dotenv";
dotenv.config();

import app, { initMastraServer } from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { initSocket } from "./socket";
import { taskOverdueWorkerService } from "./services/task-overdue-worker.service";
import { renewExpiringWatchChannels, healDegradedWatchChannels, cleanupWebhookReceipts } from "./services/gcal-watch-renewal.service";
import { NotificationWorkerService } from "./services/notification-worker.service";
import { createServiceLogger } from "./lib/logger";

const log = createServiceLogger("server");
const dbLog = createServiceLogger("database");
const cronLog = createServiceLogger("gcal-renewal");

// Prevent unhandled Mastra storage init rejections from crashing the process.
// Mastra's PostgresStore uses lazy init with "will retry on next storage call" semantics,
// but the rejected promise still propagates as unhandled if not caught globally.
process.on("unhandledRejection", (reason: unknown) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (msg.includes("MASTRA_STORAGE") || msg.includes("Connection terminated")) {
        log.warn({ err: reason }, "Mastra storage init failed (non-fatal, will retry on next call)");
        return; // swallow — Mastra will retry lazily
    }
    log.fatal({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
});

const port = Number(config.port);

const server = http.createServer(app);

const startServer = async () => {
    try {
        // Verify PostgreSQL connection before accepting traffic
        await pool.query('SELECT NOW()');

        // Ensure new motion_permission values exist
        try {
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'view_all'");
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'view_managers'");
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'view_admins'");
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'edit_all'");
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'edit_managers'");
            await pool.query("ALTER TYPE public.motion_permission ADD VALUE IF NOT EXISTS 'edit_admins'");
            dbLog.info("Successfully added new motion_permission values");
        } catch (err: unknown) {
            dbLog.warn({ err }, "Note on altering motion_permission enum");
        }

        // Ensure optimized meeting_recordings indexes exist
        try {
            await pool.query("CREATE INDEX IF NOT EXISTS idx_meeting_recordings_user_id ON public.meeting_recordings(user_id)");
            await pool.query("CREATE INDEX IF NOT EXISTS idx_meeting_recordings_meeting_id ON public.meeting_recordings(meeting_id)");
            await pool.query("CREATE INDEX IF NOT EXISTS idx_meeting_recordings_created_at_desc ON public.meeting_recordings(created_at DESC)");
            dbLog.info("Successfully verified and applied meeting recordings database indexes");
        } catch (err: unknown) {
            dbLog.warn({ err }, "Note on creating meeting recordings indexes");
        }

        // Initialize Mastra server (auto-registers agent endpoints)
        // Storage init may fail on first attempt due to connection pressure;
        // Mastra retries lazily on the first actual /chat request.
        try {
            await initMastraServer();
            log.info("Mastra server initialized (agent endpoints registered)");
        } catch (mastraErr) {
            log.error({ err: mastraErr }, "Mastra server init failed — /chat will be unavailable until storage connects");
        }

        server.listen(port, '0.0.0.0', () => {
            log.info({ port }, `Server is running at http://localhost:${port}`);
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
                cronLog.error({ err }, "renewExpiringWatchChannels error")
            );
            await healDegradedWatchChannels().catch(err =>
                cronLog.error({ err }, "healDegradedWatchChannels error")
            );
            await cleanupWebhookReceipts().catch(err =>
                cronLog.error({ err }, "cleanupWebhookReceipts error")
            );
        }, TWELVE_HOURS_MS);

        cronLog.info("Watch channel renewal cron scheduled (every 12 hours)");

        // Register Graceful Shutdown Hooks
        const gracefulShutdown = (signal: string) => {
            log.info({ signal }, "Received shutdown signal. Shutting down gracefully...");
            NotificationWorkerService.stop();
            taskOverdueWorkerService.stop();
            server.close(() => {
                pool.end().then(() => {
                    log.info("Database connection pool ended cleanly");
                    process.exit(0);
                });
            });
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    } catch (error) {
        log.fatal({ err: error }, "Failed to start server");
        process.exit(1);
    }
};

startServer();
