/**
 * Database Connection Pool
 * PostgreSQL connection using pg library
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Configure connection pool
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
        // Database connection will be retried on first request
    } else {
        console.log('✅ Database connected successfully');
        console.log('   Server time:', res.rows[0].now);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    pool.end(() => {
        console.log('Database pool has ended');
    });
});

export default pool;

