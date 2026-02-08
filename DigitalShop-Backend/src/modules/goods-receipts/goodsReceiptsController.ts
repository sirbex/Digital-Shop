import { Request, Response } from 'express';
import { z } from 'zod';
import * as GRService from './goodsReceiptsService.js';
import { logger } from '../../utils/logger.js';
import pool from '../../db/pool.js';

// Validation schemas
const CreateGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  receivedDate: z.string(),
  notes: z.string().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    purchaseOrderItemId: z.string().uuid().optional(),
    receivedQuantity: z.number().positive(),
    costPrice: z.number().nonnegative(),
    expiryDate: z.string().optional(),
    batchNumber: z.string().optional(),
    discrepancyType: z.string().optional(),
  })).min(1),
});

/**
 * Create a new goods receipt
 */
export async function createGoodsReceipt(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const validated = CreateGoodsReceiptSchema.parse(req.body);

    const gr = await GRService.createGoodsReceiptV2(pool, {
      purchaseOrderId: validated.purchaseOrderId,
      receivedDate: validated.receivedDate,
      notes: validated.notes,
      items: validated.items,
    }, userId);

    res.status(201).json({
      success: true,
      data: gr,
      message: 'Goods receipt created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues[0].message,
      });
      return;
    }
    logger.error('Error creating goods receipt', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create goods receipt',
    });
  }
}

/**
 * Get a goods receipt by ID
 */
export async function getGoodsReceipt(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Goods receipt ID is required',
      });
      return;
    }

    const gr = await GRService.getGoodsReceipt(id);

    res.json({
      success: true,
      data: gr,
    });
  } catch (error: any) {
    if (error.message === 'Goods receipt not found') {
      res.status(404).json({
        success: false,
        error: 'Goods receipt not found',
      });
      return;
    }
    logger.error('Error getting goods receipt', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get goods receipt',
    });
  }
}

/**
 * Get all goods receipts
 */
export async function getAllGoodsReceipts(req: Request, res: Response): Promise<void> {
  try {
    const filters = {
      supplierId: req.query.supplierId as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };

    const grs = await GRService.getAllGoodsReceipts(filters);

    res.json({
      success: true,
      data: grs,
    });
  } catch (error: any) {
    logger.error('Error getting goods receipts', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get goods receipts',
    });
  }
}

/**
 * Get goods receipt summary
 */
export async function getGoodsReceiptSummary(_req: Request, res: Response): Promise<void> {
  try {
    const summary = await GRService.getGoodsReceiptSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Error getting goods receipt summary', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get goods receipt summary',
    });
  }
}

/**
 * Cancel a goods receipt
 */
export async function cancelGoodsReceipt(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await GRService.cancelGoodsReceipt(pool, id, userId);

    res.json({
      success: true,
      message: 'Goods receipt cancelled successfully',
    });
  } catch (error: any) {
    logger.error('Error cancelling goods receipt', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel goods receipt',
    });
  }
}
