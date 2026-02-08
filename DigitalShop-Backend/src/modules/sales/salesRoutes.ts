import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as salesController from './salesController.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * Sales routes
 */
router.get('/', salesController.getAllSales);
router.get('/summary', salesController.getSalesSummary);
router.get('/top-products', salesController.getTopSellingProducts);
router.get('/number/:saleNumber', salesController.getSaleBySaleNumber);
router.get('/:id', salesController.getSaleById);

router.post('/', salesController.createSale);

// Void and Refund (Manager/Admin only)
router.post('/:id/void', requireManager, salesController.voidSaleHandler);
router.post('/:id/refund', requireManager, salesController.refundSaleHandler);

export default router;
