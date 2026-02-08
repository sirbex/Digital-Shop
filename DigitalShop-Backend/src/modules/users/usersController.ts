import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as usersService from './usersService.js';

// Validation schemas
const updateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/users
 * Get all users
 */
export async function getAllUsers(_req: Request, res: Response): Promise<void> {
  try {
    const users = await usersService.getAllUsers(pool);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Controller error:', error);
  }
}

/**
 * GET /api/users/:id
 * Get user by ID
 */
export async function getUserById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const user = await usersService.getUserById(pool, id);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user',
    });
  }
}

/**
 * PUT /api/users/:id
 * Update user
 */
export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Validate request body
    const data = updateUserSchema.parse(req.body);

    // Only ADMIN can update role or change active status
    if ((data.role || data.isActive !== undefined) && req.user?.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can change user roles or status',
      });
      return;
    }

    // Users can only update their own fullName (unless admin)
    if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
      res.status(403).json({
        success: false,
        error: 'You can only update your own profile',
      });
      return;
    }

    const user = await usersService.updateUser(pool, id, data);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
    });
  }
}

/**
 * DELETE /api/users/:id
 * Delete user (deactivate)
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        error: 'You cannot delete your own account',
      });
      return;
    }

    await usersService.deleteUser(pool, id);

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
    });
  }
}

/**
 * GET /api/users/role/:role
 * Get users by role
 */
export async function getUsersByRole(req: Request, res: Response): Promise<void> {
  try {
    const { role } = req.params;

    if (!['ADMIN', 'MANAGER', 'CASHIER', 'STAFF'].includes(role)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
      return;
    }

    const users = await usersService.getUsersByRole(
      pool,
      role as 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF'
    );

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Controller error:', error);
  }
}

/**
 * GET /api/users/stats
 * Get user statistics
 */
export async function getUserStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await usersService.getUserStats(pool);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user statistics',
    });
  }
}

/**
 * POST /api/users/:id/reset-password
 * Admin reset password for another user
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const bodySchema = z.object({
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    });
    const { newPassword } = bodySchema.parse(req.body);

    // Prevent resetting own password through this endpoint
    // (users should use /api/auth/change-password for their own)
    if (req.user?.id === id && req.user?.role !== 'ADMIN') {
      res.status(400).json({
        success: false,
        error: 'Use change-password endpoint for your own password',
      });
      return;
    }

    await usersService.adminResetPassword(pool, id, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    if (error instanceof Error && error.message === 'User not found') {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password',
    });
  }
}





