/**
 * Database Connection Pool
 * PostgreSQL connection using pg library
 * Follows COPILOT_INSTRUCTIONS timezone strategy
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool, types } = pg;

// Configure type parsers to prevent timezone issues
// DATE columns (1082) must return as string, not Date object
types.setTypeParser(1082, (val: string) => val); // DATE -> string (YYYY-MM-DD)
types.setTypeParser(1114, (val: string) => val); // TIMESTAMP -> string
types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ -> string

// Configure connection pool
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Set UTC timezone for all connections (MANDATORY per COPILOT_INSTRUCTIONS)
pool.on('connect', (client) => {
    client.query('SET timezone = "UTC"');
});

// Handle pool errors
pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { error: err });
    process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        logger.error('❌ Database connection failed', { error: err });
        // Database connection will be retried on first request
    } else {
        logger.info('✅ Database connected successfully');
        logger.info('Server time: ' + res.rows[0].now);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    pool.end(() => {
        logger.info('Database pool has ended');
    });
});

export default pool;

