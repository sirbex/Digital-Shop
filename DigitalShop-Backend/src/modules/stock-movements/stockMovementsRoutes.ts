import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import * as stockMovementsService from './stockMovementsService.js';
import { pool } from '../../db/pool.js';

const router = Router();

// Validation schemas
// movementType accepts REAL DB enum values (GOODS_RECEIPT, SALE, ADJUSTMENT_IN, etc.)
// Also accepts legacy group aliases (IN, OUT, ADJUSTMENT) which are mapped to real values in service
const ListMovementsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
  productId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  movementType: z.enum([
    // Real DB enum values
    'GOODS_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
    'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'EXPIRY',
    // Legacy group aliases (mapped in service layer)
    'IN', 'OUT', 'ADJUSTMENT',
  ]).optional(),
  referenceType: z.enum(['SALE', 'GOODS_RECEIPT', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'BATCH_DELETE']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/stock-movements
 * List all stock movements with pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = ListMovementsQuerySchema.parse(req.query);
    const result = await stockMovementsService.listStockMovements(pool, query.page, query.limit, {
      productId: query.productId,
      batchId: query.batchId,
      movementType: query.movementType,
      referenceType: query.referenceType,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    res.json({
      success: true,
      data: result.movements,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }

    console.error('Error listing stock movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list stock movements',
    });
  }
});

/**
 * GET /api/stock-movements/summary
 * Get stock movements summary
 */
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await stockMovementsService.getMovementsSummary(pool);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error getting movements summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get movements summary',
    });
  }
});

/**
 * GET /api/stock-movements/product/:productId
 * Get stock movements for a specific product
 */
router.get('/product/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const query = ListMovementsQuerySchema.parse(req.query);

    const result = await stockMovementsService.getProductMovements(pool, productId, query.page, query.limit);

    res.json({
      success: true,
      data: result.movements,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    });
  } catch (error: any) {
    console.error('Error getting product movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product movements',
    });
  }
});

/**
 * GET /api/stock-movements/batch/:batchId
 * Get stock movements for a specific batch
 */
router.get('/batch/:batchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const query = ListMovementsQuerySchema.parse(req.query);

    const result = await stockMovementsService.getBatchMovements(pool, batchId, query.page, query.limit);

    res.json({
      success: true,
      data: result.movements,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    });
  } catch (error: any) {
    console.error('Error getting batch movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batch movements',
    });
  }
});

/**
 * GET /api/stock-movements/:id
 * Get a single stock movement by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const movement = await stockMovementsService.getStockMovementById(pool, id);

    res.json({
      success: true,
      data: movement,
    });
  } catch (error: any) {
    console.error('Error getting stock movement:', error);
    res.status(error.message === 'Stock movement not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Failed to get stock movement',
    });
  }
});

export default router;
