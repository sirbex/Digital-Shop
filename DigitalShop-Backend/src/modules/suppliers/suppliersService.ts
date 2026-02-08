import { Pool } from 'pg';
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
