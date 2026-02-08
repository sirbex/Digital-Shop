import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserParams {
  fullName?: string;
  role?: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
  isActive?: boolean;
}

/**
 * Get all users
 */
export async function getAllUsers(pool: Pool): Promise<UserRow[]> {
  const query = `
    SELECT id, email, full_name, role, is_active, created_at, updated_at
    FROM users
    ORDER BY created_at DESC
  `;

  try {
    const result = await pool.query<UserRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get all users', error);
    throw error;
  }
}

/**
 * Get user by ID
 */
export async function getUserById(pool: Pool, id: string): Promise<UserRow | null> {
  const query = `
    SELECT id, email, full_name, role, is_active, created_at, updated_at
    FROM users
    WHERE id = $1
  `;

  try {
    const result = await pool.query<UserRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get user by ID', { id, error });
    throw error;
  }
}

/**
 * Update user
 */
export async function updateUser(
  pool: Pool,
  id: string,
  params: UpdateUserParams
): Promise<UserRow> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.fullName !== undefined) {
    updates.push(`full_name = $${paramIndex++}`);
    values.push(params.fullName);
  }

  if (params.role !== undefined) {
    updates.push(`role = $${paramIndex++}`);
    values.push(params.role);
  }

  if (params.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `
    UPDATE users
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, email, full_name, role, is_active, created_at, updated_at
  `;

  try {
    const result = await pool.query<UserRow>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    logger.info('User updated', { userId: id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update user', { id, error });
    throw error;
  }
}

/**
 * Delete user (soft delete by setting is_active = false)
 */
export async function deleteUser(pool: Pool, id: string): Promise<void> {
  const query = `
    UPDATE users
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }

    logger.info('User deactivated', { userId: id });
  } catch (error) {
    logger.error('Failed to delete user', { id, error });
    throw error;
  }
}

/**
 * Get users by role
 */
export async function getUsersByRole(
  pool: Pool,
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF'
): Promise<UserRow[]> {
  const query = `
    SELECT id, email, full_name, role, is_active, created_at, updated_at
    FROM users
    WHERE role = $1
    ORDER BY full_name
  `;

  try {
    const result = await pool.query<UserRow>(query, [role]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get users by role', { role, error });
    throw error;
  }
}

