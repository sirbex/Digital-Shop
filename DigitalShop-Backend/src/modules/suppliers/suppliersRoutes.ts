import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as suppliersController from './suppliersController.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * Supplier routes
 */
router.get('/', suppliersController.getAllSuppliers);
router.get('/with-payables', suppliersController.getSuppliersWithPayables);
router.get('/search', suppliersController.searchSuppliers);
router.get('/:id', suppliersController.getSupplierById);
router.get('/:id/transactions', suppliersController.getSupplierTransactions);

router.post('/', requireManager, suppliersController.createSupplier);
router.put('/:id', requireManager, suppliersController.updateSupplier);
router.delete('/:id', requireManager, suppliersController.deleteSupplier);

export default router;
