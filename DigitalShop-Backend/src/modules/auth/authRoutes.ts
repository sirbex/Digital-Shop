import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as authController from './authController.js';

const router = Router();

/**
 * Public routes (no authentication required)
 */
router.post('/login', authController.login);

/**
 * Protected routes (authentication required)
 */
router.post('/register', authenticate, authController.register);
router.get('/me', authenticate, authController.getCurrentUser);
router.get('/permissions', authenticate, authController.getMyPermissions);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/logout', authenticate, authController.logout);

export default router;
