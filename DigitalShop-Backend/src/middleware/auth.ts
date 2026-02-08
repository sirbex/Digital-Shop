/**
 * Authentication Middleware
 * JWT token verification and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
            };
        }
    }
}

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No authorization token provided',
            });
        }

        const token = authHeader.startsWith('Bearer ')
            ? authHeader.slice(7)
            : authHeader;

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            logger.error('JWT_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: 'Authentication configuration error',
            });
        }

        const decoded = jwt.verify(token, secret) as {
            userId?: string;  // Old token format
            id?: string;      // New token format (if updated)
            email: string;
            role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
        };

        req.user = {
            id: decoded.userId || decoded.id || '',  // Support both formats
            email: decoded.email,
            role: decoded.role,
        };
        return next();  // MUST return to prevent fallthrough
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
            });
        }
        if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token',
            });
        }
        logger.error('Authentication error:', error);
        return res.status(500).json({
            success: false,
            error: 'Authentication failed',
        });
    }
}

/**
 * Require specific roles
 */
export function requireRole(...roles: Array<'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF'>) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }

        if (!roles.includes(req.user.role)) {
            logger.warn(`Access denied for user ${req.user.id} (${req.user.role}) to ${req.path}`);
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
            });
        }

        next();
        return;
    };
}

/**
 * Require admin role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Require admin or manager role
 */
export const requireManager = requireRole('ADMIN', 'MANAGER');
