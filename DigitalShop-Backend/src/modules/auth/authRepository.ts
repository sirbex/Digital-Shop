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

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';
}

/**
 * Find user by email
 */
export async function findUserByEmail(pool: Pool, email: string): Promise<UserRow | null> {
  const query = 'SELECT * FROM users WHERE email = $1';
  
  try {
    const result = await pool.query<UserRow>(query, [email]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to find user by email', { email, error });
    throw error;
  }
}

/**
 * Find user by ID
 */
export async function findUserById(pool: Pool, id: string): Promise<UserRow | null> {
  const query = 'SELECT * FROM users WHERE id = $1';
  
  try {
    const result = await pool.query<UserRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to find user by ID', { id, error });
    throw error;
  }
}

/**
 * Create new user
 */
export async function createUser(pool: Pool, params: CreateUserParams): Promise<UserRow> {
  const query = `
    INSERT INTO users (email, password_hash, full_name, role)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  
  try {
    const result = await pool.query<UserRow>(query, [
      params.email,
      params.passwordHash,
      params.fullName,
      params.role,
    ]);
    
    logger.info('User created', { userId: result.rows[0].id, email: params.email });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create user', { email: params.email, error });
    throw error;
  }
}

/**
 * Update user's last login timestamp (optional future enhancement)
 */
export async function updateLastLogin(pool: Pool, userId: string): Promise<void> {
  const query = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1';
  
  try {
    await pool.query(query, [userId]);
  } catch (error) {
    logger.error('Failed to update last login', { userId, error });
    // Don't throw - this is non-critical
  }
}

/**
 * Check if email exists
 */
export async function emailExists(pool: Pool, email: string): Promise<boolean> {
  const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists';
  
  try {
    const result = await pool.query<{ exists: boolean }>(query, [email]);
    return result.rows[0].exists;
  } catch (error) {
    logger.error('Failed to check email existence', { email, error });
    throw error;
  }
}

/**
 * Map user_role ENUM to RBAC roles table name
 */
const ROLE_NAME_MAP: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  STAFF: 'Staff',
};

/**
 * Get permission keys for a user role
 * Maps user_role ENUM → roles.name → role_permissions → permission keys
 */
export async function getPermissionsByUserRole(
  pool: Pool,
  userRole: string
): Promise<string[]> {
  const roleName = ROLE_NAME_MAP[userRole];
  if (!roleName) {
    logger.warn('Unknown user role for permission lookup', { userRole });
    return [];
  }

  const query = `
    SELECT DISTINCT rp.permission_key
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = $1 AND r.is_active = true
    ORDER BY rp.permission_key
  `;

  try {
    const result = await pool.query<{ permission_key: string }>(query, [roleName]);
    return result.rows.map((r) => r.permission_key);
  } catch (error) {
    logger.error('Failed to get permissions by user role', { userRole, roleName, error });
    // Return empty array instead of throwing — permissions table may not exist yet
    return [];
  }
}
