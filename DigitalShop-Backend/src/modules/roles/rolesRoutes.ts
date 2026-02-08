import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import * as rolesController from './rolesController.js';

const router = Router();

// All role management routes require authentication
router.use(authenticate);

// Permissions catalog (any authenticated user can read)
router.get('/permissions', rolesController.getPermissions);

// Role CRUD (Admin only)
router.get('/', rolesController.getAllRoles);
router.get('/:id', rolesController.getRoleById);
router.post('/', requireAdmin, rolesController.createRole);
router.put('/:id', requireAdmin, rolesController.updateRole);
router.delete('/:id', requireAdmin, rolesController.deleteRole);

export default router;
