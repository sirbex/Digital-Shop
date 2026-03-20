import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string | null;
  sale_id: string | null;
  sale_number: string | null;
  issue_date: string;
  due_date: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;
  amount_due: string;
  status: string;
  notes: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoicePaymentRow {
  id: string;
  receipt_number: string;
  invoice_id: string;
  payment_date: string;
  payment_method: string;
  amount: string;
  reference_number: string | null;
  notes: string | null;
  processed_by_id: string | null;
  processed_by_name: string | null;
  created_at: string;
  check_number: string | null;
  check_status: string | null;
  bank_name: string | null;
  check_date: string | null;
}

export interface CreateInvoiceParams {
  customerId: string;
  saleId?: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  notes?: string;
  createdById?: string;
}

export interface CreatePaymentParams {
  invoiceId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNumber?: string;
  notes?: string;
  processedById?: string;
  checkNumber?: string;
  checkStatus?: string;
  bankName?: string;
  checkDate?: string;
}

/**
 * Get all invoices with customer information
 */
export async function getAllInvoices(
  pool: Pool,
  filters?: {
    customerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<InvoiceRow[]> {
  let query = `
    SELECT 
      i.*,
      c.name as customer_name,
      s.sale_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN sales s ON i.sale_id = s.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.customerId) {
    query += ` AND i.customer_id = $${paramIndex++}`;
    values.push(filters.customerId);
  }

  if (filters?.status) {
    query += ` AND i.status = $${paramIndex++}`;
    values.push(filters.status);
  }

  if (filters?.startDate) {
    query += ` AND i.issue_date >= $${paramIndex++}`;
    values.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ` AND i.issue_date <= $${paramIndex++}`;
    values.push(filters.endDate);
  }

  query += ' ORDER BY i.issue_date DESC, i.created_at DESC';

  try {
    const result = await pool.query<InvoiceRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all invoices', { filters, error });
    throw error;
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(pool: Pool, id: string): Promise<InvoiceRow | null> {
  const query = `
    SELECT 
      i.*,
      c.name as customer_name,
      s.sale_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN sales s ON i.sale_id = s.id
    WHERE i.id = $1
  `;

  try {
    const result = await pool.query<InvoiceRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get invoice by ID', { id, error });
    throw error;
  }
}

/**
 * Get invoice payments
 */
export async function getInvoicePayments(pool: Pool, invoiceId: string): Promise<InvoicePaymentRow[]> {
  const query = `
    SELECT 
      ip.*,
      u.full_name as processed_by_name
    FROM invoice_payments ip
    LEFT JOIN users u ON ip.processed_by_id = u.id
    WHERE ip.invoice_id = $1
    ORDER BY ip.payment_date DESC, ip.created_at DESC
  `;

  try {
    const result = await pool.query<InvoicePaymentRow>(query, [invoiceId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get invoice payments', { invoiceId, error });
    throw error;
  }
}

/**
 * Generate next receipt number
 */
export async function generateReceiptNumber(pool: Pool): Promise<string> {
  const query = `
    SELECT 
      receipt_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM invoice_payments 
    WHERE receipt_number LIKE 'RCP-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY receipt_number DESC 
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    
    let year: number;
    if (result.rows.length === 0) {
      const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
      year = yearResult.rows[0].year;
      return `RCP-${year}-0001`;
    }

    year = result.rows[0].current_year;
    const lastNumber = result.rows[0].receipt_number;
    const lastSequence = parseInt(lastNumber.split('-')[2]);
    const nextSequence = (lastSequence + 1).toString().padStart(4, '0');

    return `RCP-${year}-${nextSequence}`;
  } catch (error) {
    logger.error('Failed to generate receipt number', error);
    throw error;
  }
}

/**
 * Create invoice payment
 */
export async function createInvoicePayment(
  pool: Pool,
  params: CreatePaymentParams
): Promise<InvoicePaymentRow> {
  const receiptNumber = await generateReceiptNumber(pool);

  const query = `
    INSERT INTO invoice_payments (
      receipt_number, invoice_id, payment_date, payment_method,
      amount, reference_number, notes, processed_by_id,
      check_number, check_status, bank_name, check_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;

  try {
    const result = await pool.query<InvoicePaymentRow>(query, [
      receiptNumber,
      params.invoiceId,
      params.paymentDate,
      params.paymentMethod,
      params.amount,
      params.referenceNumber || null,
      params.notes || null,
      params.processedById || null,
      params.checkNumber || null,
      params.checkStatus || null,
      params.bankName || null,
      params.checkDate || null,
    ]);

    logger.info('Invoice payment created', {
      paymentId: result.rows[0].id,
      receiptNumber,
      invoiceId: params.invoiceId,
      amount: params.amount,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create invoice payment', { params, error });
    throw error;
  }
}

/**
 * Create invoice
 */
export async function createInvoice(
  pool: Pool,
  params: CreateInvoiceParams
): Promise<InvoiceRow> {
  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(pool);

  const query = `
    INSERT INTO invoices (
      invoice_number, customer_id, sale_id, issue_date, due_date,
      subtotal, tax_amount, discount_amount, total_amount,
      amount_paid, amount_due, status, notes, created_by_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $9, 'DRAFT', $10, $11)
    RETURNING *
  `;

  try {
    const result = await pool.query<InvoiceRow>(query, [
      invoiceNumber,
      params.customerId,
      params.saleId || null,
      params.issueDate,
      params.dueDate,
      params.subtotal,
      params.taxAmount,
      params.discountAmount || 0,
      params.totalAmount,
      params.notes || null,
      params.createdById || null,
    ]);

    logger.info('Invoice created', {
      invoiceId: result.rows[0].id,
      invoiceNumber,
      customerId: params.customerId,
      totalAmount: params.totalAmount,
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create invoice', { params, error });
    throw error;
  }
}

/**
 * Generate next invoice number
 */
async function generateInvoiceNumber(pool: Pool): Promise<string> {
  const query = `
    SELECT 
      invoice_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM invoices 
    WHERE invoice_number LIKE 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY invoice_number DESC 
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    
    let year: number;
    if (result.rows.length === 0) {
      const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
      year = yearResult.rows[0].year;
      return `INV-${year}-0001`;
    }

    year = result.rows[0].current_year;
    const lastNumber = result.rows[0].invoice_number;
    const lastSequence = parseInt(lastNumber.split('-')[2]);
    const nextSequence = (lastSequence + 1).toString().padStart(4, '0');

    return `INV-${year}-${nextSequence}`;
  } catch (error) {
    logger.error('Failed to generate invoice number', error);
    throw error;
  }
}

/**
 * Get customer invoices (for customer detail view)
 */
export async function getCustomerInvoices(pool: Pool, customerId: string): Promise<InvoiceRow[]> {
  const query = `
    SELECT 
      i.*,
      c.name as customer_name,
      s.sale_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN sales s ON i.sale_id = s.id
    WHERE i.customer_id = $1
    ORDER BY i.issue_date DESC, i.created_at DESC
  `;

  try {
    const result = await pool.query<InvoiceRow>(query, [customerId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get customer invoices', { customerId, error });
    throw error;
  }
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(pool: Pool): Promise<InvoiceRow[]> {
  const query = `
    SELECT 
      i.*,
      c.name as customer_name,
      s.sale_number
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN sales s ON i.sale_id = s.id
    WHERE i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID')
      AND i.due_date < CURRENT_DATE
    ORDER BY i.due_date, i.created_at
  `;

  try {
    const result = await pool.query<InvoiceRow>(query);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get overdue invoices', error);
    throw error;
  }
}

// ============================================================================
// CHECK REGISTER FUNCTIONS
// ============================================================================

export interface CheckRegisterRow {
  id: string;
  receipt_number: string;
  source: 'CUSTOMER' | 'SUPPLIER';
  party_name: string;
  party_id: string;
  payment_date: string;
  amount: string;
  check_number: string | null;
  check_status: string | null;
  bank_name: string | null;
  check_date: string | null;
  reference_number: string | null;
  notes: string | null;
  processed_by_name: string | null;
  created_at: string;
}

/**
 * Get all check payments from both invoice_payments and supplier_payments
 */
export async function getCheckRegister(
  pool: Pool,
  filters?: {
    checkStatus?: string;
    startDate?: string;
    endDate?: string;
    source?: 'CUSTOMER' | 'SUPPLIER';
  }
): Promise<CheckRegisterRow[]> {
  // Build WHERE clauses for filters
  let customerWhere = `WHERE ip.payment_method = 'CHECK'`;
  let supplierWhere = `WHERE sp.payment_method = 'CHECK'`;
  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.checkStatus) {
    customerWhere += ` AND ip.check_status = $${paramIndex}`;
    supplierWhere += ` AND sp.check_status = $${paramIndex}`;
    values.push(filters.checkStatus);
    paramIndex++;
  }

  if (filters?.startDate) {
    customerWhere += ` AND ip.payment_date >= $${paramIndex}`;
    supplierWhere += ` AND sp.payment_date >= $${paramIndex}`;
    values.push(filters.startDate);
    paramIndex++;
  }

  if (filters?.endDate) {
    customerWhere += ` AND ip.payment_date <= $${paramIndex}`;
    supplierWhere += ` AND sp.payment_date <= $${paramIndex}`;
    values.push(filters.endDate);
    paramIndex++;
  }

  // Build source filter
  const parts: string[] = [];

  if (!filters?.source || filters.source === 'CUSTOMER') {
    parts.push(`
      SELECT 
        ip.id, ip.receipt_number, 'CUSTOMER' as source,
        c.name as party_name, c.id as party_id,
        ip.payment_date, ip.amount,
        ip.check_number, ip.check_status, ip.bank_name, ip.check_date,
        ip.reference_number, ip.notes,
        u.full_name as processed_by_name,
        ip.created_at
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON ip.processed_by_id = u.id
      ${customerWhere}
    `);
  }

  if (!filters?.source || filters.source === 'SUPPLIER') {
    parts.push(`
      SELECT 
        sp.id, sp.receipt_number, 'SUPPLIER' as source,
        s.name as party_name, s.id as party_id,
        sp.payment_date, sp.amount,
        sp.check_number, sp.check_status, sp.bank_name, sp.check_date,
        sp.reference_number, sp.notes,
        u.full_name as processed_by_name,
        sp.created_at
      FROM supplier_payments sp
      JOIN suppliers s ON sp.supplier_id = s.id
      LEFT JOIN users u ON sp.processed_by_id = u.id
      ${supplierWhere}
    `);
  }

  const query = parts.join(' UNION ALL ') + ' ORDER BY payment_date DESC, created_at DESC';

  try {
    const result = await pool.query<CheckRegisterRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get check register', { filters, error });
    throw error;
  }
}

/**
 * Update check status on an invoice payment
 */
export async function updateInvoicePaymentCheckStatus(
  pool: Pool,
  paymentId: string,
  checkStatus: string
): Promise<InvoicePaymentRow> {
  const query = `
    UPDATE invoice_payments
    SET check_status = $1
    WHERE id = $2 AND payment_method = 'CHECK'
    RETURNING *
  `;

  try {
    const result = await pool.query<InvoicePaymentRow>(query, [checkStatus, paymentId]);
    if (result.rows.length === 0) {
      throw new Error('Check payment not found');
    }
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update check status', { paymentId, checkStatus, error });
    throw error;
  }
}

/**
 * Delete an invoice payment (used for bounced check reversal)
 */
export async function deleteInvoicePayment(pool: Pool, paymentId: string): Promise<void> {
  const query = `DELETE FROM invoice_payments WHERE id = $1 AND payment_method = 'CHECK'`;

  try {
    const result = await pool.query(query, [paymentId]);
    if (result.rowCount === 0) {
      throw new Error('Check payment not found');
    }
    logger.info('Invoice check payment deleted (bounced)', { paymentId });
  } catch (error) {
    logger.error('Failed to delete invoice payment', { paymentId, error });
    throw error;
  }
}
