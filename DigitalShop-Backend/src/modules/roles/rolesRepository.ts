import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

// ============================================================================
// ROW TYPES
// ============================================================================

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
  is_active: boolean;
  permission_count: string;
  created_at: string;
  updated_at: string;
}

export interface PermissionRow {
  key: string;
  module: string;
  action: string;
  description: string | null;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Get all permissions from the catalog
 */
export async function getAllPermissions(pool: Pool): Promise<PermissionRow[]> {
  const query = `
    SELECT key, module, action, description
    FROM permissions
    ORDER BY module, action
  `;
  try {
    const result = await pool.query<PermissionRow>(query);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get permissions', { error });
    throw error;
  }
}

// ============================================================================
// ROLES
// ============================================================================

/**
 * Get all active roles with permission count
 */
export async function getAllRoles(pool: Pool): Promise<RoleRow[]> {
  const query = `
    SELECT 
      r.id, r.name, r.description, r.is_system_role, r.is_active,
      r.created_at, r.updated_at,
      COUNT(rp.permission_key)::TEXT as permission_count
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.is_active = true
    GROUP BY r.id
    ORDER BY r.is_system_role DESC, r.name ASC
  `;
  try {
    const result = await pool.query<RoleRow>(query);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all roles', { error });
    throw error;
  }
}

/**
 * Get role by ID with its permission keys
 */
export async function getRoleById(
  pool: Pool,
  roleId: string
): Promise<{ role: RoleRow; permissions: string[] } | null> {
  const roleQuery = `
    SELECT 
      r.id, r.name, r.description, r.is_system_role, r.is_active,
      r.created_at, r.updated_at,
      COUNT(rp.permission_key)::TEXT as permission_count
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.id = $1
    GROUP BY r.id
  `;
  const permQuery = `
    SELECT permission_key FROM role_permissions WHERE role_id = $1
  `;

  try {
    const roleResult = await pool.query<RoleRow>(roleQuery, [roleId]);
    if (roleResult.rows.length === 0) return null;

    const permResult = await pool.query<{ permission_key: string }>(permQuery, [roleId]);

    return {
      role: roleResult.rows[0],
      permissions: permResult.rows.map((r) => r.permission_key),
    };
  } catch (error) {
    logger.error('Failed to get role by ID', { roleId, error });
    throw error;
  }
}

/**
 * Get role by name (for duplicate checking)
 */
export async function getRoleByName(
  pool: Pool,
  name: string,
  excludeId?: string
): Promise<RoleRow | null> {
  let query = `SELECT id, name, description, is_system_role, is_active, created_at, updated_at, '0' as permission_count FROM roles WHERE LOWER(name) = LOWER($1) AND is_active = true`;
  const values: any[] = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<RoleRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get role by name', { name, error });
    throw error;
  }
}

/**
 * Create a new role with permissions
 */
export async function createRole(
  pool: Pool,
  data: { name: string; description: string; permissionKeys: string[] }
): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertRole = `
      INSERT INTO roles (name, description, is_system_role)
      VALUES ($1, $2, false)
      RETURNING id
    `;
    const roleResult = await client.query(insertRole, [data.name, data.description || '']);
    const roleId = roleResult.rows[0].id;

    // Insert permission assignments
    if (data.permissionKeys.length > 0) {
      const values: any[] = [];
      const placeholders: string[] = [];
      data.permissionKeys.forEach((key, i) => {
        placeholders.push(`($1, $${i + 2})`);
        values.push(key);
      });

      const insertPerms = `
        INSERT INTO role_permissions (role_id, permission_key)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT DO NOTHING
      `;
      await client.query(insertPerms, [roleId, ...values]);
    }

    await client.query('COMMIT');
    logger.info('Role created', { roleId, name: data.name, permCount: data.permissionKeys.length });
    return roleId;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create role', { error, data });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update role name, description, and permissions
 */
export async function updateRole(
  pool: Pool,
  roleId: string,
  data: { name?: string; description?: string; permissionKeys?: string[] }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update role fields
    if (data.name !== undefined || data.description !== undefined) {
      const setClauses: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (data.name !== undefined) {
        setClauses.push(`name = $${idx++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(data.description);
      }

      values.push(roleId);
      const updateQuery = `UPDATE roles SET ${setClauses.join(', ')} WHERE id = $${idx}`;
      await client.query(updateQuery, values);
    }

    // Replace permissions if provided
    if (data.permissionKeys !== undefined) {
      // Remove all existing
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Insert new
      if (data.permissionKeys.length > 0) {
        const values: any[] = [];
        const placeholders: string[] = [];
        data.permissionKeys.forEach((key, i) => {
          placeholders.push(`($1, $${i + 2})`);
          values.push(key);
        });

        const insertPerms = `
          INSERT INTO role_permissions (role_id, permission_key)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT DO NOTHING
        `;
        await client.query(insertPerms, [roleId, ...values]);
      }
    }

    await client.query('COMMIT');
    logger.info('Role updated', { roleId, data });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to update role', { error, roleId, data });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Soft-delete a role (set is_active = false)
 */
export async function deleteRole(pool: Pool, roleId: string): Promise<void> {
  const query = `UPDATE roles SET is_active = false WHERE id = $1 AND is_system_role = false`;
  try {
    const result = await pool.query(query, [roleId]);
    if (result.rowCount === 0) {
      throw new Error('Role not found or cannot be deleted (system role)');
    }
    logger.info('Role soft-deleted', { roleId });
  } catch (error) {
    logger.error('Failed to delete role', { error, roleId });
    throw error;
  }
}
