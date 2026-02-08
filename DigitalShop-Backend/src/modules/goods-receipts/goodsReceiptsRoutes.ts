import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as GRService from './goodsReceiptsService.js';
import * as purchasesService from '../purchases/purchasesService.js';
import { authenticate, requireManager } from '../../middleware/auth.js';
import pool from '../../db/pool.js';

const router = Router();

// Validation schemas - support both naming conventions (frontend uses camelCase, db uses snake_case)
const GRItemSchema = z.object({
  productId: z.string().uuid(),
  purchaseOrderItemId: z.string().uuid().optional(),
  poItemId: z.string().uuid().optional(), // Frontend uses this name
  receivedQuantity: z.number().nonnegative('Received quantity must be non-negative'),
  costPrice: z.number().nonnegative('Cost price must be non-negative').optional(),
  unitCost: z.number().nonnegative('Unit cost must be non-negative').optional(), // Frontend uses this name
  expiryDate: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  discrepancyType: z.string().nullable().optional(),
  productName: z.string().optional(), // For display purposes
  orderedQuantity: z.number().optional(), // For display purposes
}).transform((data) => ({
  productId: data.productId,
  purchaseOrderItemId: data.purchaseOrderItemId || data.poItemId,
  receivedQuantity: data.receivedQuantity,
  costPrice: data.costPrice ?? data.unitCost ?? 0,
  expiryDate: data.expiryDate,
  batchNumber: data.batchNumber,
  discrepancyType: data.discrepancyType,
}));

const CreateGRSchema = z.object({
  purchaseOrderId: z.string().uuid().optional().nullable(),
  receivedDate: z.string().optional(),
  receiptDate: z.string().optional(), // Frontend uses this name
  notes: z.string().optional().nullable(),
  receivedBy: z.string().uuid().optional(), // Frontend may send this
  items: z.array(GRItemSchema).min(1, 'At least one item is required'),
}).transform((data) => ({
  purchaseOrderId: data.purchaseOrderId,
  receivedDate: data.receivedDate || data.receiptDate || new Date().toISOString(),
  notes: data.notes,
  items: data.items,
}));

const ListGRsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
  status: z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']).optional(),
  supplierId: z.string().uuid().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/goods-receipts
 * List all goods receipts with pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = ListGRsQuerySchema.parse(req.query);
    const result = await GRService.listGoodsReceipts(pool, query.page, query.limit, {
      status: query.status,
      supplierId: query.supplierId,
    });

    res.json({
      success: true,
      data: result.receipts,
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

    console.error('Error listing goods receipts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list goods receipts',
    });
  }
});

/**
 * GET /api/goods-receipts/summary
 * Get goods receipt summary
 */
router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await GRService.getGoodsReceiptSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error getting goods receipt summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get goods receipt summary',
    });
  }
});

/**
 * POST /api/goods-receipts/hydrate-from-po
 * Create a goods receipt pre-populated from a purchase order
 */
router.post('/hydrate-from-po', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const { purchaseOrderId } = req.body;
    const userId = (req as any).user?.id;

    if (!purchaseOrderId) {
      res.status(400).json({
        success: false,
        error: 'purchaseOrderId is required',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    // Get the PO with items
    const po = await purchasesService.getPurchaseOrderById(pool, purchaseOrderId);
    
    if (!po) {
      res.status(404).json({
        success: false,
        error: 'Purchase order not found',
      });
      return;
    }

    // Check if PO is in a receivable status (SENT, APPROVED, or PARTIAL)
    if (!['SENT', 'APPROVED', 'PARTIAL'].includes(po.status)) {
      res.status(400).json({
        success: false,
        error: `Cannot create goods receipt from a PO with status "${po.status}". PO must be SENT, APPROVED, or PARTIAL.`,
      });
      return;
    }

    // Create goods receipt from PO data
    const result = await GRService.createGoodsReceiptV2(pool, {
      purchaseOrderId: po.id,
      receivedDate: new Date().toISOString(),
      notes: `Created from PO ${po.orderNumber}`,
      items: po.items.map((item: any) => ({
        productId: item.productId || item.product_id,
        purchaseOrderItemId: item.id,
        receivedQuantity: item.orderedQuantity || item.ordered_quantity || item.quantity || 0,
        costPrice: item.unitPrice || item.unit_price || item.costPrice || 0,
        expiryDate: undefined,
        batchNumber: undefined,
      })),
    }, userId);

    res.status(201).json({
      success: true,
      data: {
        grId: result.id,
        ...result,
      },
      message: `Goods receipt ${result.receiptNumber} created from PO ${po.orderNumber}`,
    });
  } catch (error: any) {
    console.error('Error creating goods receipt from PO:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create goods receipt from purchase order',
    });
  }
});

/**
 * GET /api/goods-receipts/:id
 * Get a single goods receipt by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const gr = await GRService.getGoodsReceipt(id);

    res.json({
      success: true,
      data: gr,
    });
  } catch (error: any) {
    console.error('Error getting goods receipt:', error);
    res.status(error.message === 'Goods receipt not found' ? 404 : 500).json({
      success: false,
      error: error.message || 'Failed to get goods receipt',
    });
  }
});

/**
 * POST /api/goods-receipts
 * Create a new goods receipt
 */
router.post('/', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CreateGRSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const result = await GRService.createGoodsReceiptV2(pool, {
      purchaseOrderId: validatedData.purchaseOrderId || undefined,
      receivedDate: validatedData.receivedDate,
      notes: validatedData.notes || undefined,
      items: validatedData.items.map(item => ({
        productId: item.productId,
        purchaseOrderItemId: item.purchaseOrderItemId,
        receivedQuantity: item.receivedQuantity,
        costPrice: item.costPrice,
        expiryDate: item.expiryDate || undefined,
        batchNumber: item.batchNumber || undefined,
      })),
    }, userId);

    res.status(201).json({
      success: true,
      data: result,
      message: `Goods receipt ${result.receiptNumber} created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error creating goods receipt:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create goods receipt',
    });
  }
});

/**
 * POST /api/goods-receipts/:id/cancel
 * Cancel a goods receipt
 */
router.post('/:id/cancel', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    await GRService.cancelGoodsReceipt(pool, id, userId);

    res.json({
      success: true,
      message: 'Goods receipt cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling goods receipt:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel goods receipt',
    });
  }
});

// Zod schema for updating an item — accepts both costPrice (canonical) and unitCost (legacy)
const UpdateGRItemSchema = z.object({
  receivedQuantity: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().optional(), // Legacy name
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
}).transform((data) => ({
  receivedQuantity: data.receivedQuantity,
  unitCost: data.costPrice ?? data.unitCost, // Repository expects unitCost
  batchNumber: data.batchNumber,
  expiryDate: data.expiryDate,
}));

/**
 * PUT /api/goods-receipts/:id/items/:itemId
 * Update a goods receipt item
 */
router.put('/:id/items/:itemId', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, itemId } = req.params;
    const validatedData = UpdateGRItemSchema.parse(req.body);

    const updated = await GRService.updateGoodsReceiptItem(id, itemId, validatedData);

    res.json({
      success: true,
      data: updated,
      message: 'Item updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error updating goods receipt item:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update item',
    });
  }
});

/**
 * POST /api/goods-receipts/:id/finalize
 * Finalize a goods receipt - creates inventory batches and updates stock
 */
router.post('/:id/finalize', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await GRService.finalizeGoodsReceipt(id);

    res.json({
      success: true,
      data: {
        receipt: result.gr,
        costAlerts: result.costAlerts,
      },
      message: 'Goods receipt finalized successfully',
    });
  } catch (error: any) {
    console.error('Error finalizing goods receipt:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to finalize goods receipt',
    });
  }
});

export default router;
