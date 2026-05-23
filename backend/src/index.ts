import app from "./app";
import { config } from "./config";
import pool from "./config/pg";
import "./config/supabase";
import http from "http";
import { initSocket } from "./socket";
import { taskOverdueWorkerService } from "./services/task-overdue-worker.service";
import { renewExpiringWatchChannels, healDegradedWatchChannels } from "./services/gcal-watch-renewal.service";

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
            console.log('[database]: Successfully added new motion_permission values');
        } catch (err: any) {
            console.warn('[database]: Note on altering motion_permission enum:', err.message);
        }

        server.listen(port, '0.0.0.0', () => {
            console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
        });

        // Initialize Socket.io (auth middleware + event handlers live in socket.ts)
        initSocket(server);

        // Start background worker for overdue tasks
        taskOverdueWorkerService.start();

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

    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

startServer();
