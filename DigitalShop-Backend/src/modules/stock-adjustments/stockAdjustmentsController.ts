import { Request, Response } from 'express';
import * as stockAdjustmentsService from './stockAdjustmentsService.js';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import pool from '../../db/pool.js';

// Validation schema matching service types
const CreateStockAdjustmentSchema = z.object({
  productId: z.string().uuid({ message: 'Product is required' }),
  batchId: z.string().uuid().optional(),
  adjustmentType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN']),
  quantity: z.number()
    .positive({ message: 'Quantity must be positive' }),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
  notes: z.string().max(1000).optional(),
});

export const stockAdjustmentsController = {
  /**
   * Create stock adjustment
   */
  async createStockAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      // Validate request body
      const validated = CreateStockAdjustmentSchema.parse(req.body);

      const adjustment = await stockAdjustmentsService.createStockAdjustment({
        productId: validated.productId,
        batchId: validated.batchId,
        adjustmentType: validated.adjustmentType,
        quantity: validated.quantity,
        unitCost: validated.unitCost,
        reason: validated.reason,
        notes: validated.notes,
        createdById: userId,
      });

      res.status(201).json({
        success: true,
        data: adjustment,
        message: 'Stock adjustment created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating stock adjustment', { error: error.message });
      
      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          error: error.issues[0]?.message || 'Validation error',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create stock adjustment',
      });
    }
  },

  /**
   * Get stock adjustment by ID
   */
  async getStockAdjustment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const adjustment = await stockAdjustmentsService.getStockAdjustmentById(id);

      res.json({
        success: true,
        data: adjustment,
      });
    } catch (error: any) {
      logger.error('Error getting stock adjustment', { error: error.message });
      
      if (error.message === 'Stock adjustment not found') {
        res.status(404).json({
          success: false,
          error: 'Stock adjustment not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get stock adjustment',
      });
    }
  },

  /**
   * Get all stock adjustments
   */
  async getAllStockAdjustments(req: Request, res: Response): Promise<void> {
    try {
      const { productId, adjustmentType, startDate, endDate, page, limit } = req.query;

      // Use paginated method if page/limit provided
      if (page || limit) {
        const result = await stockAdjustmentsService.listStockAdjustments(
          pool,
          parseInt(page as string) || 1,
          parseInt(limit as string) || 50,
          {
            productId: productId as string,
            adjustmentType: adjustmentType as string,
          }
        );

        res.json({
          success: true,
          data: result.adjustments,
          pagination: {
            page: parseInt(page as string) || 1,
            limit: parseInt(limit as string) || 50,
            total: result.total,
          },
        });
        return;
      }

      // Use non-paginated method
      const adjustments = await stockAdjustmentsService.getAllStockAdjustments({
        productId: productId as string,
        adjustmentType: adjustmentType as string,
        startDate: startDate as string,
        endDate: endDate as string,
      });

      res.json({
        success: true,
        data: adjustments,
      });
    } catch (error: any) {
      logger.error('Error getting stock adjustments', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch stock adjustments',
      });
    }
  },

  /**
   * Get stock adjustments summary
   */
  async getStockAdjustmentsSummary(_req: Request, res: Response): Promise<void> {
    try {
      const summary = await stockAdjustmentsService.getStockAdjustmentsSummary();

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Error getting stock adjustments summary', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch summary',
      });
    }
  },

  /**
   * Get available adjustment types
   */
  async getAdjustmentTypes(_req: Request, res: Response): Promise<void> {
    try {
      const types = stockAdjustmentsService.getAdjustmentTypes();

      res.json({
        success: true,
        data: types,
      });
    } catch (error: any) {
      logger.error('Error getting adjustment types', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch adjustment types',
      });
    }
  },
};
