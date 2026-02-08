import { Pool } from 'pg';
import * as rolesRepository from './rolesRepository.js';

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface Permission {
  key: string;
  module: string;
  action: string;
  description: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  isActive: boolean;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleWithPermissions extends Role {
  permissions: string[];
}

// ============================================================================
// MAPPERS
// ============================================================================

function toRole(row: rolesRepository.RoleRow): Role {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isSystemRole: row.is_system_role,
    isActive: row.is_active,
    permissionCount: parseInt(row.permission_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPermission(row: rolesRepository.PermissionRow): Permission {
  return {
    key: row.key,
    module: row.module,
    action: row.action,
    description: row.description,
  };
}

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Get all permissions from the catalog
 */
export async function getAllPermissions(pool: Pool): Promise<Permission[]> {
  const rows = await rolesRepository.getAllPermissions(pool);
  return rows.map(toPermission);
}

/**
 * Get all active roles with permission counts
 */
export async function getAllRoles(pool: Pool): Promise<Role[]> {
  const rows = await rolesRepository.getAllRoles(pool);
  return rows.map(toRole);
}

/**
 * Get a single role by ID with its permission keys
 */
export async function getRoleById(pool: Pool, roleId: string): Promise<RoleWithPermissions> {
  const result = await rolesRepository.getRoleById(pool, roleId);
  if (!result) {
    throw new Error('Role not found');
  }
  return {
    ...toRole(result.role),
    permissions: result.permissions,
  };
}

/**
 * Create a new role
 */
export async function createRole(
  pool: Pool,
  data: { name: string; description: string; permissionKeys: string[] }
): Promise<string> {
  // Duplicate check
  const existing = await rolesRepository.getRoleByName(pool, data.name);
  if (existing) {
    throw new Error(`A role with name "${data.name}" already exists`);
  }

  return rolesRepository.createRole(pool, data);
}

/**
 * Update an existing role
 */
export async function updateRole(
  pool: Pool,
  roleId: string,
  data: { name?: string; description?: string; permissionKeys?: string[] }
): Promise<void> {
  // Verify role exists
  const existing = await rolesRepository.getRoleById(pool, roleId);
  if (!existing) {
    throw new Error('Role not found');
  }

  // System roles: only allow permission changes, not name/description
  if (existing.role.is_system_role && (data.name || data.description)) {
    throw new Error('Cannot modify name or description of a system role');
  }

  // Duplicate name check
  if (data.name) {
    const duplicate = await rolesRepository.getRoleByName(pool, data.name, roleId);
    if (duplicate) {
      throw new Error(`A role with name "${data.name}" already exists`);
    }
  }

  return rolesRepository.updateRole(pool, roleId, data);
}

/**
 * Delete (soft) a role
 */
export async function deleteRole(pool: Pool, roleId: string): Promise<void> {
  const existing = await rolesRepository.getRoleById(pool, roleId);
  if (!existing) {
    throw new Error('Role not found');
  }
  if (existing.role.is_system_role) {
    throw new Error('Cannot delete a system role');
  }

  return rolesRepository.deleteRole(pool, roleId);
}
