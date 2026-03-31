import { Pool } from 'pg';
import Decimal from 'decimal.js';
import { logger } from '../../utils/logger.js';
import * as suppliersRepository from './suppliersRepository.js';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  balance: number;
  paymentTerms: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierData {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateSupplierData {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  isActive?: boolean;
  notes?: string;
}

export interface SupplierTransaction {
  type: 'PURCHASE';
  referenceNumber: string;
  transactionDate: string;
  amount: number;
  status: string;
  createdAt: string;
}

/**
 * Convert database row to Supplier object
 */
function toSupplier(row: suppliersRepository.SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person,
    email: row.email,
    phone: row.phone,
    address: row.address,
    balance: parseFloat(row.balance),
    paymentTerms: row.payment_terms,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all suppliers
 */
export async function getAllSuppliers(pool: Pool): Promise<Supplier[]> {
  const rows = await suppliersRepository.getAllSuppliers(pool);
  return rows.map(toSupplier);
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(pool: Pool, id: string): Promise<Supplier> {
  const row = await suppliersRepository.getSupplierById(pool, id);

  if (!row) {
    throw new Error('Supplier not found');
  }

  return toSupplier(row);
}

/**
 * Search suppliers
 */
export async function searchSuppliers(pool: Pool, search: string): Promise<Supplier[]> {
  const rows = await suppliersRepository.searchSuppliers(pool, search);
  return rows.map(toSupplier);
}

/**
 * Create supplier
 */
export async function createSupplier(pool: Pool, data: CreateSupplierData): Promise<Supplier> {
  // ==========================================================================
  // DUPLICATE PREVENTION: Check phone and email uniqueness before creating
  // ==========================================================================
  if (data.phone) {
    const existingByPhone = await suppliersRepository.getSupplierByPhone(pool, data.phone);
    if (existingByPhone) {
      throw new Error(`A supplier with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  if (data.email) {
    const existingByEmail = await suppliersRepository.getSupplierByEmail(pool, data.email);
    if (existingByEmail) {
      throw new Error(`A supplier with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  const row = await suppliersRepository.createSupplier(pool, data);
  return toSupplier(row);
}

/**
 * Update supplier
 */
export async function updateSupplier(
  pool: Pool,
  id: string,
  data: UpdateSupplierData
): Promise<Supplier> {
  // ==========================================================================
  // DUPLICATE PREVENTION: Check phone and email uniqueness (excluding current supplier)
  // ==========================================================================
  if (data.phone) {
    const existingByPhone = await suppliersRepository.getSupplierByPhone(pool, data.phone, id);
    if (existingByPhone) {
      throw new Error(`A supplier with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  if (data.email) {
    const existingByEmail = await suppliersRepository.getSupplierByEmail(pool, data.email, id);
    if (existingByEmail) {
      throw new Error(`A supplier with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  const row = await suppliersRepository.updateSupplier(pool, id, data);
  return toSupplier(row);
}

/**
 * Delete supplier
 */
export async function deleteSupplier(pool: Pool, id: string): Promise<void> {
  await suppliersRepository.deleteSupplier(pool, id);
  logger.info('Supplier deleted', { supplierId: id });
}

/**
 * Get suppliers with payables
 */
export async function getSuppliersWithPayables(pool: Pool): Promise<Supplier[]> {
  const rows = await suppliersRepository.getSuppliersWithPayables(pool);
  return rows.map(toSupplier);
}

/**
 * Get supplier transactions
 */
export async function getSupplierTransactions(
  pool: Pool,
  supplierId: string
): Promise<SupplierTransaction[]> {
  const rows = await suppliersRepository.getSupplierTransactions(pool, supplierId);

  return rows.map(row => ({
    type: row.type,
    referenceNumber: row.reference_number,
    transactionDate: row.transaction_date,
    amount: parseFloat(row.amount),
    status: row.status,
    createdAt: row.created_at,
  }));
}

// ============================================================================
// SUPPLIER PAYMENTS
// ============================================================================

export interface SupplierPayment {
  id: string;
  receiptNumber: string;
  supplierId: string;
  purchaseOrderId: string | null;
  paymentDate: string;
  paymentMethod: string;
  amount: number;
  referenceNumber: string | null;
  notes: string | null;
  processedById: string | null;
  processedByName?: string | null;
  createdAt: string;
  checkNumber: string | null;
  checkStatus: string | null;
  bankName: string | null;
  checkDate: string | null;
}

export interface RecordSupplierPaymentData {
  amount: number;
  paymentMethod: string;
  paymentDate?: string;
  purchaseOrderId?: string | null;
  referenceNumber?: string;
  notes?: string;
  checkNumber?: string;
  checkStatus?: string;
  bankName?: string;
  checkDate?: string;
}

function toSupplierPayment(row: any): SupplierPayment {
  return {
    id: row.id,
    receiptNumber: row.receipt_number,
    supplierId: row.supplier_id,
    purchaseOrderId: row.purchase_order_id,
    paymentDate: row.payment_date,
    paymentMethod: row.payment_method,
    amount: parseFloat(row.amount),
    referenceNumber: row.reference_number,
    notes: row.notes,
    processedById: row.processed_by_id,
    processedByName: row.processed_by_name || null,
    createdAt: row.created_at,
    checkNumber: row.check_number || null,
    checkStatus: row.check_status || null,
    bankName: row.bank_name || null,
    checkDate: row.check_date || null,
  };
}

/**
 * Record a payment to a supplier
 */
export async function recordSupplierPayment(
  pool: Pool,
  supplierId: string,
  data: RecordSupplierPaymentData,
  processedById: string
): Promise<SupplierPayment> {
  // Verify supplier exists
  const supplier = await getSupplierById(pool, supplierId);

  // Validate payment amount doesn't exceed balance
  if (new Decimal(data.amount).greaterThan(new Decimal(supplier.balance).plus(0.01))) {
    throw new Error(
      `Payment amount (${data.amount}) exceeds supplier balance (${supplier.balance})`
    );
  }

  // Validate check fields when payment method is CHECK
  if (data.paymentMethod === 'CHECK' && !data.checkNumber) {
    throw new Error('Check number is required for check payments');
  }

  const row = await suppliersRepository.createSupplierPayment(pool, {
    supplierId,
    purchaseOrderId: data.purchaseOrderId,
    paymentDate: data.paymentDate,
    paymentMethod: data.paymentMethod,
    amount: data.amount,
    referenceNumber: data.referenceNumber,
    notes: data.notes,
    processedById,
    checkNumber: data.checkNumber,
    checkStatus: data.paymentMethod === 'CHECK' ? (data.checkStatus || 'RECEIVED') : undefined,
    bankName: data.bankName,
    checkDate: data.checkDate,
  });

  logger.info('Supplier payment recorded', {
    supplierId,
    amount: data.amount,
    receiptNumber: row.receipt_number,
  });

  return toSupplierPayment(row);
}

/**
 * Get all payments for a supplier
 */
export async function getSupplierPayments(
  pool: Pool,
  supplierId: string
): Promise<SupplierPayment[]> {
  // Verify supplier exists
  await getSupplierById(pool, supplierId);

  const rows = await suppliersRepository.getSupplierPayments(pool, supplierId);
  return rows.map(toSupplierPayment);
}
