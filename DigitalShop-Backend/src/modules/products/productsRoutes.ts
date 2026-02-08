import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as productsController from './productsController.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * Product routes
 */
router.get('/', productsController.getAllProducts);
router.get('/low-stock', productsController.getLowStockProducts);
router.get('/sku/:sku', productsController.getProductBySku);
router.get('/barcode/:barcode', productsController.getProductByBarcode);
router.get('/:id', productsController.getProductById);

router.post('/', requireManager, productsController.createProduct);
router.put('/:id', requireManager, productsController.updateProduct);
router.delete('/:id', requireManager, productsController.deleteProduct);

export default router;
