import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';
import * as customersRepository from './customersRepository.js';

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  customerGroupId: string | null;
  groupName: string | null;
  balance: number;
  creditLimit: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  customerGroupId?: string;
  creditLimit?: number;
  notes?: string;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  customerGroupId?: string;
  creditLimit?: number;
  isActive?: boolean;
  notes?: string;
}

export interface CustomerTransaction {
  type: 'SALE' | 'PAYMENT';
  referenceNumber: string;
  transactionDate: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

/**
 * Convert database row to Customer object
 */
function toCustomer(row: customersRepository.CustomerWithGroupRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    customerGroupId: row.customer_group_id,
    groupName: row.group_name,
    balance: parseFloat(row.balance),
    creditLimit: parseFloat(row.credit_limit),
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all customers
 */
export async function getAllCustomers(pool: Pool): Promise<Customer[]> {
  const rows = await customersRepository.getAllCustomers(pool);
  return rows.map(toCustomer);
}

/**
 * Get customer by ID
 */
export async function getCustomerById(pool: Pool, id: string): Promise<Customer> {
  const row = await customersRepository.getCustomerById(pool, id);

  if (!row) {
    throw new Error('Customer not found');
  }

  return toCustomer(row);
}

/**
 * Search customers
 */
export async function searchCustomers(pool: Pool, search: string): Promise<Customer[]> {
  const rows = await customersRepository.searchCustomers(pool, search);
  return rows.map(toCustomer);
}

/**
 * Create customer
 */
export async function createCustomer(pool: Pool, data: CreateCustomerData): Promise<Customer> {
  // Validate credit limit is non-negative
  if (data.creditLimit !== undefined && data.creditLimit < 0) {
    throw new Error('Credit limit cannot be negative');
  }

  // ==========================================================================
  // DUPLICATE PREVENTION: Check name, phone, and email uniqueness before creating
  // ==========================================================================
  
  // Check for duplicate name
  if (data.name) {
    const existingByName = await customersRepository.getCustomerByName(pool, data.name);
    if (existingByName) {
      throw new Error(`A customer with name "${data.name}" already exists. Please use a different name.`);
    }
  }

  if (data.phone) {
    const existingByPhone = await customersRepository.getCustomerByPhone(pool, data.phone);
    if (existingByPhone) {
      throw new Error(`A customer with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  if (data.email) {
    const existingByEmail = await customersRepository.getCustomerByEmail(pool, data.email);
    if (existingByEmail) {
      throw new Error(`A customer with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  const row = await customersRepository.createCustomer(pool, data);
  const customer = await customersRepository.getCustomerById(pool, row.id);
  
  if (!customer) {
    throw new Error('Failed to retrieve created customer');
  }

  return toCustomer(customer);
}

/**
 * Update customer
 */
export async function updateCustomer(
  pool: Pool,
  id: string,
  data: UpdateCustomerData
): Promise<Customer> {
  // Validate credit limit if provided
  if (data.creditLimit !== undefined && data.creditLimit < 0) {
    throw new Error('Credit limit cannot be negative');
  }

  // ==========================================================================
  // DUPLICATE PREVENTION: Check name, phone, and email uniqueness (excluding current customer)
  // ==========================================================================
  
  // Check for duplicate name
  if (data.name) {
    const existingByName = await customersRepository.getCustomerByName(pool, data.name, id);
    if (existingByName) {
      throw new Error(`A customer with name "${data.name}" already exists. Please use a different name.`);
    }
  }

  if (data.phone) {
    const existingByPhone = await customersRepository.getCustomerByPhone(pool, data.phone, id);
    if (existingByPhone) {
      throw new Error(`A customer with phone number "${data.phone}" already exists: ${existingByPhone.name}`);
    }
  }

  if (data.email) {
    const existingByEmail = await customersRepository.getCustomerByEmail(pool, data.email, id);
    if (existingByEmail) {
      throw new Error(`A customer with email "${data.email}" already exists: ${existingByEmail.name}`);
    }
  }

  const row = await customersRepository.updateCustomer(pool, id, data);
  const customer = await customersRepository.getCustomerById(pool, row.id);

  if (!customer) {
    throw new Error('Failed to retrieve updated customer');
  }

  return toCustomer(customer);
}

/**
 * Delete customer
 */
export async function deleteCustomer(pool: Pool, id: string): Promise<void> {
  await customersRepository.deleteCustomer(pool, id);
  logger.info('Customer deleted', { customerId: id });
}

/**
 * Get customers with outstanding balance
 */
export async function getCustomersWithBalance(pool: Pool): Promise<Customer[]> {
  const rows = await customersRepository.getCustomersWithBalance(pool);
  return rows.map(toCustomer);
}

/**
 * Get customer transactions (simple list)
 */
export async function getCustomerTransactions(
  pool: Pool,
  customerId: string
): Promise<CustomerTransaction[]> {
  const rows = await customersRepository.getCustomerTransactions(pool, customerId);

  return rows.map(row => ({
    type: row.type,
    referenceNumber: row.reference_number,
    transactionDate: row.transaction_date,
    amount: parseFloat(row.debit) - parseFloat(row.credit),
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
  }));
}

/**
 * Customer Ledger Entry interface (like QuickBooks statement)
 */
export interface CustomerLedgerEntry {
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT';
  referenceNumber: string;
  transactionDate: string;
  debit: number;
  credit: number;
  description: string;
  runningBalance: number;
  createdAt: string;
}

/**
 * Get customer ledger (full statement with running balance)
 * Like QuickBooks customer statement
 */
export async function getCustomerLedger(
  pool: Pool,
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<CustomerLedgerEntry[]> {
  const rows = await customersRepository.getCustomerLedger(pool, customerId, startDate, endDate);

  return rows.map(row => ({
    type: row.type,
    referenceNumber: row.reference_number,
    transactionDate: row.transaction_date,
    debit: parseFloat(row.debit) || 0,
    credit: parseFloat(row.credit) || 0,
    description: row.description,
    runningBalance: parseFloat(row.running_balance) || 0,
    createdAt: row.created_at,
  }));
}

/**
 * Customer Account Summary interface (like QuickBooks)
 */
export interface CustomerAccountSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  paidInvoiceCount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  aging: {
    current: number;
    overdue1to30: number;
    overdue31to60: number;
    overdue61to90: number;
    overdueOver90: number;
  };
  lastSaleDate: string | null;
  lastPaymentDate: string | null;
}

/**
 * Get customer account summary with aging (like QuickBooks)
 */
export async function getCustomerAccountSummary(
  pool: Pool,
  customerId: string
): Promise<CustomerAccountSummary> {
  const row = await customersRepository.getCustomerAccountSummary(pool, customerId);

  return {
    totalInvoiced: parseFloat(row.total_invoiced) || 0,
    totalPaid: parseFloat(row.total_paid) || 0,
    totalOutstanding: parseFloat(row.total_outstanding) || 0,
    paidInvoiceCount: parseInt(row.paid_invoice_count) || 0,
    openInvoiceCount: parseInt(row.open_invoice_count) || 0,
    overdueInvoiceCount: parseInt(row.overdue_invoice_count) || 0,
    aging: {
      current: parseFloat(row.current_due) || 0,
      overdue1to30: parseFloat(row.overdue_1_30) || 0,
      overdue31to60: parseFloat(row.overdue_31_60) || 0,
      overdue61to90: parseFloat(row.overdue_61_90) || 0,
      overdueOver90: parseFloat(row.overdue_over_90) || 0,
    },
    lastSaleDate: row.last_sale_date,
    lastPaymentDate: row.last_payment_date,
  };
}

/**
 * Check if customer can make a credit purchase
 * Validates against credit limit
 */
export async function canMakeCreditPurchase(
  pool: Pool,
  customerId: string,
  amount: number
): Promise<{ allowed: boolean; reason?: string; availableCredit?: number }> {
  const customer = await getCustomerById(pool, customerId);
  
  // Customer balance is negative when they owe money (from triggers)
  // currentDebt = absolute value of negative balance
  const currentDebt = Math.abs(Math.min(0, customer.balance));
  const totalDebt = currentDebt + amount;
  const availableCredit = Math.max(0, customer.creditLimit - currentDebt);

  if (customer.creditLimit <= 0) {
    return {
      allowed: false,
      reason: 'Customer has no credit limit set',
      availableCredit: 0,
    };
  }

  if (totalDebt > customer.creditLimit) {
    return {
      allowed: false,
      reason: `Credit limit exceeded. Current debt: ${currentDebt.toFixed(2)}, Requested: ${amount.toFixed(2)}, Credit limit: ${customer.creditLimit.toFixed(2)}`,
      availableCredit,
    };
  }

  return { 
    allowed: true,
    availableCredit,
  };
}
