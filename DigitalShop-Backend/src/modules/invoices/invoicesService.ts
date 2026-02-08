import { Pool } from 'pg';
import Decimal from 'decimal.js';
import * as invoicesRepository from './invoicesRepository.js';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string | null;
  saleId: string | null;
  saleNumber: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';
  notes: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoicePayment {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  notes: string | null;
  processedById: string | null;
  processedByName: string | null;
  createdAt: string;
}

export interface CreateInvoiceData {
  customerId: string;
  saleId?: string;
  issueDate?: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  notes?: string;
  createdById?: string;
}

export interface CreatePaymentData {
  invoiceId: string;
  paymentDate?: string;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'CREDIT';
  amount: number;
  referenceNumber?: string;
  notes?: string;
  processedById?: string;
}

/**
 * Convert database row to Invoice object
 */
function toInvoice(row: invoicesRepository.InvoiceRow): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    saleId: row.sale_id,
    saleNumber: row.sale_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.tax_amount),
    discountAmount: parseFloat(row.discount_amount),
    totalAmount: parseFloat(row.total_amount),
    amountPaid: parseFloat(row.amount_paid),
    amountDue: parseFloat(row.amount_due),
    status: row.status as any,
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to InvoicePayment object
 */
function toInvoicePayment(row: invoicesRepository.InvoicePaymentRow): InvoicePayment {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    invoiceId: row.invoice_id,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    amount: parseFloat(row.amount),
    referenceNumber: row.reference_number,
    notes: row.notes,
    processedById: row.processed_by_id,
    processedByName: row.processed_by_name,
    createdAt: row.created_at,
  };
}

/**
 * Get all invoices
 */
export async function getAllInvoices(
  pool: Pool,
  filters?: {
    customerId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<Invoice[]> {
  const rows = await invoicesRepository.getAllInvoices(pool, filters);
  return rows.map(toInvoice);
}

/**
 * Get invoice by ID with payments
 */
export async function getInvoiceById(pool: Pool, id: string): Promise<Invoice & { payments: InvoicePayment[] }> {
  const invoiceRow = await invoicesRepository.getInvoiceById(pool, id);

  if (!invoiceRow) {
    throw new Error('Invoice not found');
  }

  const paymentRows = await invoicesRepository.getInvoicePayments(pool, id);

  return {
    ...toInvoice(invoiceRow),
    payments: paymentRows.map(toInvoicePayment),
  };
}

/**
 * Get customer invoices
 */
export async function getCustomerInvoices(pool: Pool, customerId: string): Promise<Invoice[]> {
  const rows = await invoicesRepository.getCustomerInvoices(pool, customerId);
  return rows.map(toInvoice);
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(pool: Pool): Promise<Invoice[]> {
  const rows = await invoicesRepository.getOverdueInvoices(pool);
  return rows.map(toInvoice);
}

/**
 * Create invoice
 */
export async function createInvoice(pool: Pool, data: CreateInvoiceData): Promise<Invoice> {
  // Validate data
  if (!data.customerId) {
    throw new Error('Customer ID is required');
  }

  if (!data.dueDate) {
    throw new Error('Due date is required');
  }

  if (data.totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  // Validate amounts with Decimal.js
  const subtotal = new Decimal(data.subtotal);
  const taxAmount = new Decimal(data.taxAmount);
  const discountAmount = new Decimal(data.discountAmount || 0);
  const calculatedTotal = subtotal.plus(taxAmount).minus(discountAmount);

  if (!calculatedTotal.equals(new Decimal(data.totalAmount))) {
    throw new Error('Total amount does not match calculated total');
  }

  // Check customer credit limit if applicable
  const customerResult = await pool.query(
    'SELECT balance, credit_limit FROM customers WHERE id = $1',
    [data.customerId]
  );

  if (customerResult.rows.length === 0) {
    throw new Error('Customer not found');
  }

  const customer = customerResult.rows[0];
  const currentBalance = new Decimal(customer.balance);
  const creditLimit = new Decimal(customer.credit_limit);
  const newBalance = currentBalance.plus(data.totalAmount);

  if (creditLimit.greaterThan(0) && newBalance.abs().greaterThan(creditLimit)) {
    throw new Error(`Customer credit limit of ${creditLimit.toFixed(2)} would be exceeded`);
  }

  // Create invoice
  const params: invoicesRepository.CreateInvoiceParams = {
    customerId: data.customerId,
    saleId: data.saleId,
    issueDate: data.issueDate || new Date().toISOString().split('T')[0],
    dueDate: data.dueDate,
    subtotal: subtotal.toNumber(),
    taxAmount: taxAmount.toNumber(),
    discountAmount: discountAmount.toNumber(),
    totalAmount: data.totalAmount,
    notes: data.notes,
    createdById: data.createdById,
  };

  const invoiceRow = await invoicesRepository.createInvoice(pool, params);
  return toInvoice(invoiceRow);
}

/**
 * Record invoice payment
 */
export async function recordPayment(pool: Pool, data: CreatePaymentData): Promise<InvoicePayment> {
  // Validate payment data
  if (!data.invoiceId) {
    throw new Error('Invoice ID is required');
  }

  if (!data.paymentMethod) {
    throw new Error('Payment method is required');
  }

  if (data.amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  // Get invoice to validate payment
  const invoice = await invoicesRepository.getInvoiceById(pool, data.invoiceId);

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const amountDue = new Decimal(invoice.amount_due);
  const paymentAmount = new Decimal(data.amount);

  // Allow small overpayment tolerance (1 cent)
  if (paymentAmount.greaterThan(amountDue.plus(0.01))) {
    throw new Error(`Payment amount (${paymentAmount.toFixed(2)}) exceeds amount due (${amountDue.toFixed(2)})`);
  }

  // Create payment
  const params: invoicesRepository.CreatePaymentParams = {
    invoiceId: data.invoiceId,
    paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    referenceNumber: data.referenceNumber,
    notes: data.notes,
    processedById: data.processedById,
  };

  const paymentRow = await invoicesRepository.createInvoicePayment(pool, params);
  return toInvoicePayment(paymentRow);
}

/**
 * Get invoice payments
 */
export async function getInvoicePayments(pool: Pool, invoiceId: string): Promise<InvoicePayment[]> {
  const rows = await invoicesRepository.getInvoicePayments(pool, invoiceId);
  return rows.map(toInvoicePayment);
}

/**
 * Get invoice summary statistics
 */
export async function getInvoiceSummary(pool: Pool, customerId?: string): Promise<any> {
  let query = `
    SELECT 
      COUNT(*) as total_invoices,
      COALESCE(SUM(CASE WHEN status IN ('DRAFT', 'SENT') THEN 1 ELSE 0 END), 0) as unpaid_count,
      COALESCE(SUM(CASE WHEN status = 'PARTIALLY_PAID' THEN 1 ELSE 0 END), 0) as partial_count,
      COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) as paid_count,
      COALESCE(SUM(CASE WHEN status = 'OVERDUE' THEN 1 ELSE 0 END), 0) as overdue_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(amount_paid), 0) as total_paid,
      COALESCE(SUM(amount_due), 0) as total_due
    FROM invoices
    WHERE 1=1
  `;

  const values: any[] = [];
  if (customerId) {
    query += ' AND customer_id = $1';
    values.push(customerId);
  }

  try {
    const result = await pool.query(query, values);
    return {
      totalInvoices: parseInt(result.rows[0].total_invoices) || 0,
      unpaidCount: parseInt(result.rows[0].unpaid_count) || 0,
      partialCount: parseInt(result.rows[0].partial_count) || 0,
      paidCount: parseInt(result.rows[0].paid_count) || 0,
      overdueCount: parseInt(result.rows[0].overdue_count) || 0,
      totalAmount: parseFloat(result.rows[0].total_amount) || 0,
      totalPaid: parseFloat(result.rows[0].total_paid) || 0,
      totalDue: parseFloat(result.rows[0].total_due) || 0,
    };
  } catch (error) {
    throw new Error('Failed to get invoice summary');
  }
}
