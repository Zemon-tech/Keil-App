import { Pool } from 'pg';
import pino from 'pino';
import { config } from './index';

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

if (!config.databaseUrl) {
    logger.error('❌ [database]: DATABASE_URL is not defined in environment variables');
    process.exit(1);
}

// Create a new pg Pool (singleton)
const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: {
        rejectUnauthorized: false
    },
    // Best practice: cap the pool size for standard limits, especially on Direct Connection mode
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
