import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as inventoryService from './inventoryService.js';

// Validation schemas — enums match DB types in 01_schema.sql
const batchFiltersSchema = z.object({
  productId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'DEPLETED', 'EXPIRED', 'QUARANTINED']).optional(),
  expiringSoon: z.string().transform(val => val === 'true').optional(),
  daysToExpiry: z.string().transform(val => parseInt(val)).optional(),
});

const movementFiltersSchema = z.object({
  productId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  movementType: z.enum([
    'GOODS_RECEIPT', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT',
    'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE', 'EXPIRY'
  ]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  adjustmentType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN']),
  quantity: z.number().positive(),
  reason: z.string().min(1).max(500),
});

/**
 * GET /api/inventory/batches
 * Get all inventory batches with filters
 */
export async function getAllBatches(req: Request, res: Response): Promise<void> {
  try {
    const filters = batchFiltersSchema.parse(req.query);

    const batches = await inventoryService.getAllBatches(pool, filters);

    res.json({
      success: true,
      data: batches,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batches',
    });
  }
}

/**
 * GET /api/inventory/batches/:id
 * Get batch by ID
 */
export async function getBatchById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const batch = await inventoryService.getBatchById(pool, id);

    res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Batch not found') {
      res.status(404).json({
        success: false,
        error: 'Batch not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve batch',
    });
  }
}

/**
 * GET /api/inventory/batches/product/:productId
 * Get available batches for product (FEFO order)
 */
export async function getAvailableBatchesForProduct(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;

    const batches = await inventoryService.getAvailableBatchesForProduct(pool, productId);

    res.json({
      success: true,
      data: batches,
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available batches',
    });
  }
}

/**
 * POST /api/inventory/batches/select
 * Select batches for quantity using FEFO logic
 */
export async function selectBatchForQuantity(req: Request, res: Response): Promise<void> {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      res.status(400).json({
        success: false,
        error: 'Valid productId and quantity are required',
      });
      return;
    }

    const allocations = await inventoryService.selectBatchForQuantity(
      pool,
      productId,
      quantity
    );

    res.json({
      success: true,
      data: allocations,
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to select batches',
    });
  }
}

/**
 * GET /api/inventory/movements
 * Get stock movements with filters
 */
export async function getStockMovements(req: Request, res: Response): Promise<void> {
  try {
    const filters = movementFiltersSchema.parse(req.query);

    const movements = await inventoryService.getStockMovements(pool, filters);

    res.json({
      success: true,
      data: movements,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve stock movements',
    });
  }
}

/**
 * POST /api/inventory/adjust
 * Perform stock adjustment
 */
export async function performStockAdjustment(req: Request, res: Response): Promise<void> {
  try {
    const data = stockAdjustmentSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    await inventoryService.performStockAdjustment(pool, {
      ...data,
      userId,
    });

    res.json({
      success: true,
      message: 'Stock adjustment completed successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform stock adjustment',
    });
  }
}

/**
 * GET /api/inventory/low-stock
 * Get low stock products
 */
export async function getLowStockProducts(_req: Request, res: Response): Promise<void> {
  try {
    const products = await inventoryService.getLowStockProducts(pool);

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    if (res.headersSent) {
      console.error('Headers already sent, error:', error);
      return;
    }
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve low stock products',
    });
  }
}

/**
 * GET /api/inventory/valuation
 * Get inventory valuation
 */
export async function getInventoryValuation(_req: Request, res: Response): Promise<void> {
  try {
    const valuation = await inventoryService.getInventoryValuation(pool);

    res.status(200).json({
      success: true,
      data: valuation,
    });
  } catch (error) {
    if (res.headersSent) {
      console.error('Headers already sent, error:', error);
      return;
    }
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve inventory valuation',
    });
  }
}

/**
 * GET /api/inventory/expiring
 * Get expiring batches
 */
export async function getExpiringBatches(req: Request, res: Response): Promise<void> {
  try {
    const { days } = req.query;
    const daysToExpiry = days ? parseInt(days as string) : 30;

    const batches = await inventoryService.getExpiringBatches(pool, daysToExpiry);

    res.status(200).json({
      success: true,
      data: batches,
    });
  } catch (error) {
    if (res.headersSent) {
      console.error('Headers already sent, error:', error);
      return;
    }
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve expiring batches',
    });
  }
}






