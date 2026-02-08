import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { logger } from '../../utils/logger.js';
import * as usersRepository from './usersRepository.js';

const SALT_ROUNDS = 10;

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserData {
  fullName?: string;
  role?: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
  isActive?: boolean;
}

/**
 * Convert database row to User object
 */
function toUser(row: usersRepository.UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all users
 */
export async function getAllUsers(pool: Pool): Promise<User[]> {
  const rows = await usersRepository.getAllUsers(pool);
  return rows.map(toUser);
}

/**
 * Get user by ID
 */
export async function getUserById(pool: Pool, id: string): Promise<User> {
  const row = await usersRepository.getUserById(pool, id);

  if (!row) {
    throw new Error('User not found');
  }

  return toUser(row);
}

/**
 * Update user
 */
export async function updateUser(
  pool: Pool,
  id: string,
  data: UpdateUserData
): Promise<User> {
  const params: usersRepository.UpdateUserParams = {};

  if (data.fullName !== undefined) {
    params.fullName = data.fullName;
  }

  if (data.role !== undefined) {
    params.role = data.role;
  }

  if (data.isActive !== undefined) {
    params.isActive = data.isActive;
  }

  const row = await usersRepository.updateUser(pool, id, params);
  return toUser(row);
}

/**
 * Delete user (deactivate)
 */
export async function deleteUser(pool: Pool, id: string): Promise<void> {
  await usersRepository.deleteUser(pool, id);
  logger.info('User deleted', { userId: id });
}

/**
 * Get users by role
 */
export async function getUsersByRole(
  pool: Pool,
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF'
): Promise<User[]> {
  const rows = await usersRepository.getUsersByRole(pool, role);
  return rows.map(toUser);
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: {
    ADMIN: number;
    MANAGER: number;
    CASHIER: number;
    STAFF: number;
  };
}

/**
 * Get user statistics (counts by role and status)
 */
export async function getUserStats(pool: Pool): Promise<UserStats> {
  const query = `
    SELECT
      COUNT(*)::integer as total,
      COUNT(*) FILTER (WHERE is_active = true)::integer as active,
      COUNT(*) FILTER (WHERE is_active = false)::integer as inactive,
      COUNT(*) FILTER (WHERE role = 'ADMIN')::integer as admin_count,
      COUNT(*) FILTER (WHERE role = 'MANAGER')::integer as manager_count,
      COUNT(*) FILTER (WHERE role = 'CASHIER')::integer as cashier_count,
      COUNT(*) FILTER (WHERE role = 'STAFF')::integer as staff_count
    FROM users
  `;

  try {
    const result = await pool.query(query);
    const row = result.rows[0];

    return {
      total: row.total,
      active: row.active,
      inactive: row.inactive,
      byRole: {
        ADMIN: row.admin_count,
        MANAGER: row.manager_count,
        CASHIER: row.cashier_count,
        STAFF: row.staff_count,
      },
    };
  } catch (error) {
    logger.error('Failed to get user stats', { error });
    throw error;
  }
}

/**
 * Admin reset password for another user (no current password required)
 */
export async function adminResetPassword(
  pool: Pool,
  userId: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }

  const user = await usersRepository.getUserById(pool, userId);
  if (!user) {
    throw new Error('User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [passwordHash, userId]
  );

  logger.info('Admin reset password for user', { userId });
}
