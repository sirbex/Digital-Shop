import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as invoicesService from './invoicesService.js';

const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  saleId: z.string().uuid().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  subtotal: z.number().min(0),
  taxAmount: z.number().min(0),
  discountAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT']),
  amount: z.number().min(0.01),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const invoiceFiltersSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * GET /api/invoices
 * Get all invoices with filters
 */
export async function getAllInvoices(req: Request, res: Response): Promise<void> {
  try {
    const filters = invoiceFiltersSchema.parse(req.query);

    const invoices = await invoicesService.getAllInvoices(pool, filters);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    logger.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoices',
    });
  }
}

/**
 * GET /api/invoices/:id
 * Get invoice by ID with payments
 */
export async function getInvoiceById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const invoice = await invoicesService.getInvoiceById(pool, id);

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    logger.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Invoice not found') {
      res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice',
    });
  }
}

/**
 * GET /api/customers/:customerId/invoices
 * Get invoices for specific customer
 */
export async function getCustomerInvoices(req: Request, res: Response): Promise<void> {
  try {
    const { customerId } = req.params;

    const invoices = await invoicesService.getCustomerInvoices(pool, customerId);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    logger.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer invoices',
    });
  }
}

/**
 * GET /api/invoices/overdue
 * Get all overdue invoices
 */
export async function getOverdueInvoices(req: Request, res: Response): Promise<void> {
  try {
    const invoices = await invoicesService.getOverdueInvoices(pool);

    res.json({
      success: true,
      data: invoices,
    });
  } catch (error) {
    logger.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve overdue invoices',
    });
  }
}

/**
 * GET /api/invoices/summary
 * Get invoice summary statistics
 */
export async function getInvoiceSummary(req: Request, res: Response): Promise<void> {
  try {
    const { customerId } = req.query;

    const summary = await invoicesService.getInvoiceSummary(
      pool,
      customerId as string | undefined
    );

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice summary',
    });
  }
}

/**
 * POST /api/invoices
 * Create new invoice
 */
export async function createInvoice(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const validated = createInvoiceSchema.parse(req.body);
    
    const data = {
      ...validated,
      createdById: userId,
    };

    const invoice = await invoicesService.createInvoice(pool, data);

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Invoice created successfully',
    });
  } catch (error) {
    logger.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    });
  }
}

/**
 * POST /api/invoices/:id/payments
 * Record payment for invoice
 */
export async function recordPayment(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const validated = recordPaymentSchema.parse(req.body);

    const data = {
      ...validated,
      invoiceId: id,
      processedById: userId,
    };

    const payment = await invoicesService.recordPayment(pool, data);

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment recorded successfully',
    });
  } catch (error) {
    logger.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to record payment',
    });
  }
}

/**
 * GET /api/invoices/:id/payments
 * Get payments for invoice
 */
export async function getInvoicePayments(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const payments = await invoicesService.getInvoicePayments(pool, id);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    logger.error('Controller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve invoice payments',
    });
  }
}
