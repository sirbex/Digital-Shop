import { Request, Response } from 'express';
import { z } from 'zod';
import pool from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as purchasesService from './purchasesService.js';

// Validation schemas
const createPOItemSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const createPOSchema = z.object({
  supplierId: z.string().uuid(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(createPOItemSchema).min(1),
});

/**
 * GET /api/purchases
 */
export async function getAllPurchaseOrders(req: Request, res: Response): Promise<void> {
  try {
    const { supplierId, status, startDate, endDate } = req.query;

    const pos = await purchasesService.getAllPurchaseOrders(pool, {
      supplierId: supplierId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({
      success: true,
      data: pos,
    });
  } catch (error: any) {
    logger.error('Error getting purchase orders', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve purchase orders',
    });
  }
}

/**
 * GET /api/purchases/:id
 */
export async function getPurchaseOrderById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const po = await purchasesService.getPurchaseOrderById(pool, id);

    res.json({
      success: true,
      data: po,
    });
  } catch (error: any) {
    if (error.message === 'Purchase order not found') {
      res.status(404).json({
        success: false,
        error: 'Purchase order not found',
      });
      return;
    }
    logger.error('Error getting purchase order', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve purchase order',
    });
  }
}

/**
 * POST /api/purchases
 */
export async function createPurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const data = createPOSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const poId = await purchasesService.createPurchaseOrder(pool, data, userId);
    const po = await purchasesService.getPurchaseOrderById(pool, poId);

    res.status(201).json({
      success: true,
      data: po,
      message: 'Purchase order created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }
    logger.error('Error creating purchase order', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create purchase order',
    });
  }
}

/**
 * PUT /api/purchases/:id/status
 */
export async function updatePurchaseOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const result = await purchasesService.updatePOStatusV2(pool, id, status, userId);

    res.json({
      success: true,
      data: result,
      message: `Purchase order status updated to ${status}`,
    });
  } catch (error: any) {
    logger.error('Error updating purchase order status', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update purchase order status',
    });
  }
}







