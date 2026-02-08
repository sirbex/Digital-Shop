/**
 * DigitalShop Backend Server
 * Point of Sale, Inventory, and Reports System
 */

import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import pool from './db/pool.js';

// Load environment variables from Backend directory regardless of CWD
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Create Express app
const app = express();
const PORT = process.env.PORT || 8340;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Trust proxy (required when behind Nginx/Caddy/load balancer)
// Enables correct client IP detection for rate limiting and logging
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Security headers
app.use(helmet());

// Response compression (gzip/brotli)
app.use(compression());

// CORS
app.use(
    cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5030'],
        credentials: true,
    })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - relaxed for development
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // 1000 requests per minute
    message: 'Too many requests from this IP, please try again later',
});
app.use('/api/', limiter);

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', async (_req: Request, res: Response) => {
    try {
        // Test database connection
        const result = await pool.query('SELECT NOW()');

        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            dbTime: result.rows[0].now,
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});

// ============================================================================
// API ROUTES
// ============================================================================

// Import module routes
import authRoutes from './modules/auth/authRoutes.js';
import usersRoutes from './modules/users/usersRoutes.js';
import productsRoutes from './modules/products/productsRoutes.js';
import customersRoutes from './modules/customers/customersRoutes.js';
import suppliersRoutes from './modules/suppliers/suppliersRoutes.js';
import salesRoutes from './modules/sales/salesRoutes.js';
import inventoryRoutes from './modules/inventory/inventoryRoutes.js';
import purchasesRoutes from './modules/purchases/purchasesRoutes.js';
import cashRegisterRoutes from './modules/cash-register/cashRegisterRoutes.js';
import reportsRoutes from './modules/reports/reportsRoutes.js';
import goodsReceiptsRoutes from './modules/goods-receipts/goodsReceiptsRoutes.js';
import stockAdjustmentsRoutes from './modules/stock-adjustments/stockAdjustmentsRoutes.js';
import stockMovementsRoutes from './modules/stock-movements/stockMovementsRoutes.js';
import holdRoutes from './modules/pos/holdRoutes.js';
import invoicesRoutes from './modules/invoices/invoicesRoutes.js';
import expensesRoutes from './modules/expenses/expensesRoutes.js';
import systemRoutes from './modules/system/systemRoutes.js';
import rolesRoutes from './modules/roles/rolesRoutes.js';

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/cash-register', cashRegisterRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/goods-receipts', goodsReceiptsRoutes);
app.use('/api/stock-adjustments', stockAdjustmentsRoutes);
app.use('/api/stock-movements', stockMovementsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/pos/hold', holdRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
    });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);

    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
    logger.info('✨ DigitalShop Backend Server');
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📡 API: http://localhost:${PORT}/api`);
    logger.info(`❤️  Health: http://localhost:${PORT}/health`);
});

// ============================================================================
// PROCESS EVENT HANDLERS
// ============================================================================

// Catch unhandled promise rejections (prevents silent crashes)
process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection:', reason);
    // In production, log and continue; in dev, crash to surface bugs
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

// Catch uncaught exceptions (prevents silent crashes)
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    // Always exit on uncaught exceptions — the process is in an undefined state
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

export default app;
