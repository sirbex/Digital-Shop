import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as invoicesController from './invoicesController.js';

const router = Router();

// All invoice routes require authentication
router.use(authenticate);

/**
 * GET /api/invoices
 * Get all invoices with filters
 */
router.get('/', invoicesController.getAllInvoices);

/**
 * GET /api/invoices/summary
 * Get invoice summary statistics
 * Must be before /:id to avoid matching 'summary' as ID
 */
router.get('/summary', invoicesController.getInvoiceSummary);

/**
 * GET /api/invoices/overdue
 * Get all overdue invoices
 * Must be before /:id
 */
router.get('/overdue', invoicesController.getOverdueInvoices);

/**
 * GET /api/invoices/checks
 * Get check register (all check payments)
 * Must be before /:id to avoid matching 'checks' as ID
 */
router.get('/checks', invoicesController.getCheckRegister);

/**
 * PATCH /api/invoices/checks/:id/status
 * Update check status (Manager+)
 */
router.patch('/checks/:id/status', requireManager, invoicesController.updateCheckStatus);

/**
 * POST /api/invoices/checks/:id/bounce
 * Handle bounced check (Manager+)
 */
router.post('/checks/:id/bounce', requireManager, invoicesController.bounceCheck);

/**
 * GET /api/invoices/:id
 * Get invoice by ID with payments
 */
router.get('/:id', invoicesController.getInvoiceById);

/**
 * POST /api/invoices
 * Create new invoice (Manager+)
 */
router.post('/', requireManager, invoicesController.createInvoice);

/**
 * POST /api/invoices/:id/payments
 * Record payment for invoice (Manager+)
 */
router.post('/:id/payments', requireManager, invoicesController.recordPayment);

/**
 * GET /api/invoices/:id/payments
 * Get payments for invoice
 */
router.get('/:id/payments', invoicesController.getInvoicePayments);

export default router;
