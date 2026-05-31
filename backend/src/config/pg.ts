import { Pool, types } from 'pg';
import pino from 'pino';

// Initialize Pino logger for database connection events
const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

// Read DATABASE_URL directly from process.env so that test setup can override
// it before this module is imported (config/index.ts eagerly snapshots env vars
// at import time which breaks test DB isolation).
const databaseUrl = process.env.DATABASE_URL || "";

if (!databaseUrl) {
    logger.error('❌ [database]: DATABASE_URL is not defined in environment variables');
    process.exit(1);
}

// Configure pg to parse TIMESTAMPTZ as UTC to avoid timezone shifts
// This ensures that the time component is preserved exactly as stored
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) => {
    return new Date(value + '+00:00'); // Parse as UTC
});

// Create a new pg Pool (singleton)
// NOTE: Supabase session pooler (port 5432) limits total connections to 15.
// Mastra uses a separate pool (max: 5), so this pool gets the remaining 10.
const isLocalDb = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDb ? false : {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Event listeners for connection monitoring
pool.on('connect', () => {
    logger.info('[database]: PostgreSQL Connection Established');
});

pool.on('error', (err) => {
    logger.error(`[database]: Unexpected error on idle client: ${err.message}`);
    process.exit(-1);
});

// Helper function to execute queries using the pool
export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
};

export default pool;
