import { Router } from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import * as systemController from './systemController.js';

const router = Router();

// All system routes require authentication
router.use(authenticate);

// Settings routes (Admin only)
router.get('/settings', requireAdmin, systemController.getSettings);
router.patch('/settings', requireAdmin, systemController.updateSettings);

// Database stats (Admin only)
router.get('/stats', requireAdmin, systemController.getDatabaseStats);

// Reset operations (Admin only)
router.get('/reset/preview', requireAdmin, systemController.getResetPreview);
router.post('/reset', requireAdmin, systemController.executeReset);

export default router;
