import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as authService from './authService.js';
import * as authRepository from './authRepository.js';
// Import shared Zod schemas from DigitalShop-Shared
import * as UserSchemas from '../../../../DigitalShop-Shared/dist/zod/user.js';

// Auth Controller - Fixed namespace imports
/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body with shared schema
    const data = UserSchemas.LoginSchema.parse(req.body);

    // Authenticate user
    const authResponse = await authService.login(pool, data);

    res.json({
      success: true,
      data: authResponse,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
}

/**
 * POST /api/auth/register
 * Register new user
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body with shared schema
    const data = UserSchemas.CreateUserSchema.parse(req.body);

    // Only ADMIN can create ADMIN/MANAGER users
    if ((data.role === 'ADMIN' || data.role === 'MANAGER') && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can create admin or manager accounts',
      });
      return;
    }

    // Register user
    const authResponse = await authService.register(pool, data);

    res.status(201).json({
      success: true,
      data: authResponse,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
}

/**
 * GET /api/auth/me
 * Get current user info
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    // User info already attached by auth middleware
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
    });
  }
}

/**
 * POST /api/auth/change-password
 * Change user password
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    // User must be authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
      });
      return;
    }

    // Validate request body with shared schema
    const data = UserSchemas.ChangePasswordSchema.parse(req.body);

    // Change password
    await authService.changePassword(
      pool,
      req.user.id,
      data.currentPassword,
      data.newPassword
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change password',
    });
  }
}

/**
 * POST /api/auth/logout
 * Logout user (client should discard token)
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    // JWT is stateless - client must delete token
    // This endpoint exists for consistency and future enhancements (token blacklist, etc.)
    
    logger.info('User logged out', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
}

/**
 * GET /api/auth/permissions
 * Get current user's permission keys based on their role
 */
export async function getMyPermissions(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const permissions = await authRepository.getPermissionsByUserRole(pool, req.user.role);

    res.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve permissions',
    });
  }
}





