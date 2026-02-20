import mongoose from "mongoose";
import { config } from "../config";

export const getHealthData = () => {
    return {
        status: "ok",
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        supabase: config.supabaseUrl ? "configured" : "missing",
        timestamp: new Date().toISOString()
    };
};
