import pool from "../config/pg";
import { config } from "../config";

export const getHealthData = async () => {
    let dbStatus = "disconnected";
    try {
        await pool.query("SELECT 1");
        dbStatus = "connected";
    } catch {
        dbStatus = "error";
    }

    return {
        status: "ok",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        database: dbStatus,
        supabase: config.supabaseUrl ? "configured" : "missing",
        timestamp: new Date().toISOString()
    };
};
