import { Router } from 'express';
import { authenticate, requireAdmin, requireManager } from '../../middleware/auth.js';
import * as usersController from './usersController.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * User routes
 * NOTE: Static routes MUST come before :id parameter routes
 */
router.get('/stats', requireManager, usersController.getUserStats);
router.get('/role/:role', requireManager, usersController.getUsersByRole);
router.get('/', requireManager, usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.post('/:id/reset-password', requireAdmin, usersController.resetPassword);
router.delete('/:id', requireAdmin, usersController.deleteUser);

export default router;
