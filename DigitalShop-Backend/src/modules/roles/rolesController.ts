import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import * as rolesService from './rolesService.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const CreateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(100),
  description: z.string().max(500).default(''),
  permissionKeys: z.array(z.string().min(1)).min(1, 'At least one permission is required'),
});

const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissionKeys: z.array(z.string().min(1)).optional(),
});

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/roles/permissions
 * Get all permissions from the catalog
 */
export async function getPermissions(_req: Request, res: Response): Promise<void> {
  try {
    const permissions = await rolesService.getAllPermissions(pool);
    res.json({ success: true, data: permissions });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve permissions',
    });
  }
}

/**
 * GET /api/roles
 * Get all roles
 */
export async function getAllRoles(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await rolesService.getAllRoles(pool);
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve roles',
    });
  }
}

/**
 * GET /api/roles/:id
 * Get role by ID with permissions
 */
export async function getRoleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const role = await rolesService.getRoleById(pool, id);
    res.json({ success: true, data: role });
  } catch (error) {
    if (error instanceof Error && error.message === 'Role not found') {
      res.status(404).json({ success: false, error: 'Role not found' });
      return;
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve role',
    });
  }
}

/**
 * POST /api/roles
 * Create new role
 */
export async function createRole(req: Request, res: Response): Promise<void> {
  try {
    const validated = CreateRoleSchema.parse(req.body);
    const roleId = await rolesService.createRole(pool, validated);
    const role = await rolesService.getRoleById(pool, roleId);

    res.status(201).json({
      success: true,
      data: role,
      message: 'Role created successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create role',
    });
  }
}

/**
 * PUT /api/roles/:id
 * Update role
 */
export async function updateRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = UpdateRoleSchema.parse(req.body);
    await rolesService.updateRole(pool, id, validated);
    const role = await rolesService.getRoleById(pool, id);

    res.json({
      success: true,
      data: role,
      message: 'Role updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors[0].message });
      return;
    }
    if (error instanceof Error && error.message === 'Role not found') {
      res.status(404).json({ success: false, error: 'Role not found' });
      return;
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update role',
    });
  }
}

/**
 * DELETE /api/roles/:id
 * Soft-delete role
 */
export async function deleteRole(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await rolesService.deleteRole(pool, id);

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Role not found') {
      res.status(404).json({ success: false, error: 'Role not found' });
      return;
    }
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete role',
    });
  }
}
