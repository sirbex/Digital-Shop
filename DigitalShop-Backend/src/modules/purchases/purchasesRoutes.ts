import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as purchasesService from './purchasesService.js';
import pool from '../../db/pool.js';

const router = Router();

// Validation schemas
const POItemSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

const CreatePOSchema = z.object({
  supplierId: z.string().uuid(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(POItemSchema).min(1, 'Purchase order must have at least one item'),
});

const UpdatePOStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED']),
});

const ListPOsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val) : 50)),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'PARTIAL', 'RECEIVED', 'CANCELLED']).optional(),
  supplierId: z.string().uuid().optional(),
});

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/purchases
 * List purchase orders with pagination
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = ListPOsQuerySchema.parse(req.query);
    const result = await purchasesService.listPurchaseOrders(pool, query.page, query.limit, {
      status: query.status,
      supplierId: query.supplierId,
    });

    res.json({
      success: true,
      data: result.orders,
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

    console.error('Error listing purchase orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list purchase orders',
    });
  }
});

/**
 * GET /api/purchases/:id
 * Get PO by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
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
    console.error('Error getting purchase order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get purchase order',
    });
  }
});

/**
 * POST /api/purchases
 * Create purchase order
 */
router.post('/', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = CreatePOSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const result = await purchasesService.createPurchaseOrderV2(pool, {
      supplierId: validatedData.supplierId,
      orderDate: validatedData.orderDate,
      expectedDeliveryDate: validatedData.expectedDeliveryDate,
      paymentTerms: validatedData.paymentTerms,
      notes: validatedData.notes,
      items: validatedData.items,
    }, userId);

    res.status(201).json({
      success: true,
      data: result,
      message: `Purchase order ${result.orderNumber} created successfully`,
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

    console.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create purchase order',
    });
  }
});

/**
 * PUT /api/purchases/:id/status
 * Update PO status
 */
router.put('/:id/status', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = UpdatePOStatusSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User ID is required',
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
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error updating purchase order status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update purchase order status',
    });
  }
});

/**
 * POST /api/purchases/:id/approve
 * Approve purchase order (changes status to APPROVED)
 */
router.post('/:id/approve', requireManager, async (req: Request, res: Response): Promise<void> => {
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

    const result = await purchasesService.updatePOStatusV2(pool, id, 'APPROVED', userId);

    res.json({
      success: true,
      data: result,
      message: 'Purchase order approved successfully',
    });
  } catch (error: any) {
    console.error('Error approving purchase order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve purchase order',
    });
  }
});

/**
 * POST /api/purchases/:id/cancel
 * Cancel purchase order
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

    const result = await purchasesService.updatePOStatusV2(pool, id, 'CANCELLED', userId);

    res.json({
      success: true,
      data: result,
      message: 'Purchase order cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel purchase order',
    });
  }
});

export default router;
