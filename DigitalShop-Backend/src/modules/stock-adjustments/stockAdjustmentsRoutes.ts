import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { stockAdjustmentsController } from './stockAdjustmentsController.js';
import * as stockAdjustmentsService from './stockAdjustmentsService.js';
import { authenticate, requireManager } from '../../middleware/auth.js';
import pool from '../../db/pool.js';

const router = Router();

// Validation schemas
const CreateAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional().nullable(),
  adjustmentType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN']),
  quantity: z.number().positive('Quantity must be positive'),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional().nullable(),
});

const ListAdjustmentsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
  adjustmentType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN']).optional(),
  productId: z.string().uuid().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/stock-adjustments
 * Get all stock adjustments with pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = ListAdjustmentsQuerySchema.parse(req.query);
    const result = await stockAdjustmentsService.listStockAdjustments(pool, query.page, query.limit, {
      adjustmentType: query.adjustmentType,
      productId: query.productId,
    });

    res.json({
      success: true,
      data: result.adjustments,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ success: false, error: 'Invalid query parameters' });
      return;
    }
    console.error('Error listing adjustments:', error);
    res.status(500).json({ success: false, error: 'Failed to list stock adjustments' });
  }
});

/**
 * GET /api/stock-adjustments/types
 * Get available adjustment types
 */
router.get('/types', async (_req: Request, res: Response): Promise<void> => {
  try {
    const types = stockAdjustmentsService.getAdjustmentTypes();
    res.json({
      success: true,
      data: types,
    });
  } catch (error: any) {
    console.error('Error getting adjustment types:', error);
    res.status(500).json({ success: false, error: 'Failed to get adjustment types' });
  }
});

/**
 * GET /api/stock-adjustments/summary
 * Get stock adjustments summary statistics
 */
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await stockAdjustmentsService.getStockAdjustmentsSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error getting adjustments summary:', error);
    res.status(500).json({ success: false, error: 'Failed to get adjustments summary' });
  }
});

/**
 * GET /api/stock-adjustments/:id
 * Get a specific stock adjustment
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adjustment = await stockAdjustmentsService.getStockAdjustmentById(id);
    
    res.json({
      success: true,
      data: adjustment,
    });
  } catch (error: any) {
    if (error.message === 'Stock adjustment not found') {
      res.status(404).json({ success: false, error: 'Stock adjustment not found' });
      return;
    }
    console.error('Error getting adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to get stock adjustment' });
  }
});

/**
 * POST /api/stock-adjustments
 * Create a new stock adjustment
 */
router.post('/', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const validated = CreateAdjustmentSchema.parse(req.body);

    const adjustment = await stockAdjustmentsService.createStockAdjustment({
      productId: validated.productId,
      batchId: validated.batchId || undefined,
      adjustmentType: validated.adjustmentType,
      quantity: validated.quantity,
      unitCost: validated.unitCost,
      reason: validated.reason,
      notes: validated.notes || undefined,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: adjustment,
      message: 'Stock adjustment created successfully',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({
        success: false,
        error: error.issues[0]?.message || 'Validation error',
      });
      return;
    }
    console.error('Error creating adjustment:', error);
    res.status(500).json({ success: false, error: 'Failed to create stock adjustment' });
  }
});

export default router;
