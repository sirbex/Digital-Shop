import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import { quotationsController } from './quotationsController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read routes
router.get('/', quotationsController.getAll);
router.get('/:id', quotationsController.getById);

// Write routes
router.post('/', quotationsController.create);
router.put('/:id', quotationsController.update);
router.patch('/:id/status', quotationsController.updateStatus);
router.post('/:id/convert', quotationsController.convertToSale);
router.delete('/:id', requireManager, quotationsController.delete);

export default router;
