import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as salesService from './salesService.js';
// Import shared Zod validation schemas
import * as SaleSchemas from '../../../../DigitalShop-Shared/dist/zod/sale.js';
import * as RefundSchemas from '../../../../DigitalShop-Shared/dist/zod/saleRefund.js';

const salesFiltersSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId: z.string().uuid().optional(),
  cashierId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT']).optional(),
  status: z.enum(['COMPLETED', 'VOID', 'REFUNDED']).optional(),
});

/**
 * GET /api/sales
 * Get all sales with filters
 */
export async function getAllSales(req: Request, res: Response): Promise<void> {
  try {
    const filters = salesFiltersSchema.parse(req.query);

    const sales = await salesService.getAllSales(pool, filters);

    res.json({
      success: true,
      data: sales,
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
      error: 'Failed to retrieve sales',
    });
  }
}

/**
 * GET /api/sales/summary
 * Get sales summary
 */
export async function getSalesSummary(req: Request, res: Response): Promise<void> {
  const { startDate, endDate } = req.query;
  
  try {
    const summary = await salesService.getSalesSummary(
      pool,
      startDate as string,
      endDate as string
    );
    
    res.status(200).json({ success: true, data: summary });
  } catch (err) {
    // Check if headers already sent to prevent ERR_HTTP_HEADERS_SENT
    if (res.headersSent) {
      console.error('Headers already sent, error:', err);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Sales summary error:', msg);
    console.error('Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    res.status(500).json({ success: false, error: msg || 'Failed to retrieve sales summary' });
  }
}

/**
 * GET /api/sales/top-products
 * Get top selling products
 */
export async function getTopSellingProducts(req: Request, res: Response): Promise<void> {
  try {
    const { limit, startDate, endDate } = req.query;

    const products = await salesService.getTopSellingProducts(
      pool,
      limit ? parseInt(limit as string) : 10,
      startDate as string,
      endDate as string
    );

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve top selling products',
    });
  }
}

/**
 * GET /api/sales/:id
 * Get sale by ID
 */
export async function getSaleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const sale = await salesService.getSaleById(pool, id);

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Sale not found') {
      res.status(404).json({
        success: false,
        error: 'Sale not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sale',
    });
  }
}

/**
 * GET /api/sales/number/:saleNumber
 * Get sale by sale number
 */
export async function getSaleBySaleNumber(req: Request, res: Response): Promise<void> {
  try {
    const { saleNumber } = req.params;

    const sale = await salesService.getSaleBySaleNumber(pool, saleNumber);

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Sale not found') {
      res.status(404).json({
        success: false,
        error: 'Sale not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sale',
    });
  }
}

/**
 * POST /api/sales
 * Create new sale
 */
export async function createSale(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const validated = SaleSchemas.CreateSaleSchema.parse(req.body);
    
    // Prepare data with cashierId from authenticated user
    const data = {
      ...validated,
      cashierId: userId,
      saleDate: validated.saleDate || new Date().toISOString(),
    };

    const saleId = await salesService.createSale(pool, data as any);

    // Retrieve created sale
    const sale = await salesService.getSaleById(pool, saleId);

    res.status(201).json({
      success: true,
      data: sale,
      message: 'Sale created successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sale',
    });
  }
}

/**
 * POST /api/sales/:id/void
 * Void a sale (Manager/Admin only)
 */
export async function voidSaleHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    
    // Validate request body (voidReason and notes only)
    const bodySchema = z.object({
      voidReason: RefundSchemas.VoidReason,
      notes: z.string().min(3, 'Void reason notes must be at least 3 characters').max(500),
    });
    const validatedBody = bodySchema.parse(req.body);

    await salesService.voidSale(
      pool,
      id, // Use ID from URL params
      validatedBody.voidReason,
      validatedBody.notes,
      userId
    );

    res.json({
      success: true,
      message: 'Sale voided successfully',
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
      error: error instanceof Error ? error.message : 'Failed to void sale',
    });
  }
}

/**
 * POST /api/sales/:id/refund
 * Process refund for a sale
 */
export async function refundSaleHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const validated = RefundSchemas.CreateRefundSchema.parse({ saleId: id, ...req.body });

    const refundId = await salesService.refundSale(pool, {
      ...validated,
      processedBy: userId,
    });

    res.json({
      success: true,
      data: { refundId },
      message: 'Refund processed successfully',
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
      error: error instanceof Error ? error.message : 'Failed to process refund',
    });
  }
}






