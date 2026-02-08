import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  customer_group_id: string | null;
  balance: string;
  credit_limit: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithGroupRow extends CustomerRow {
  group_name: string | null;
}

export interface CreateCustomerParams {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  customerGroupId?: string;
  creditLimit?: number;
  notes?: string;
}

export interface UpdateCustomerParams {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  customerGroupId?: string;
  creditLimit?: number;
  isActive?: boolean;
  notes?: string;
}

/**
 * Get all customers with group information
 */
export async function getAllCustomers(pool: Pool): Promise<CustomerWithGroupRow[]> {
  const query = `
    SELECT 
      c.*,
      cg.name as group_name
    FROM customers c
    LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
    ORDER BY c.name
  `;

  try {
    const result = await pool.query<CustomerWithGroupRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get all customers', error);
    throw error;
  }
}

/**
 * Get customer by ID with group information
 */
export async function getCustomerById(pool: Pool, id: string): Promise<CustomerWithGroupRow | null> {
  const query = `
    SELECT 
      c.*,
      cg.name as group_name
    FROM customers c
    LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
    WHERE c.id = $1
  `;

  try {
    const result = await pool.query<CustomerWithGroupRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get customer by ID', { id, error });
    throw error;
  }
}

/**
 * Search customers by name or phone
 */
export async function searchCustomers(pool: Pool, search: string): Promise<CustomerWithGroupRow[]> {
  const query = `
    SELECT 
      c.*,
      cg.name as group_name
    FROM customers c
    LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
    WHERE c.name ILIKE $1 OR c.phone ILIKE $1 OR c.email ILIKE $1
    ORDER BY c.name
    LIMIT 50
  `;

  try {
    const result = await pool.query<CustomerWithGroupRow>(query, [`%${search}%`]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to search customers', { search, error });
    throw error;
  }
}

/**
 * Get customer by phone number (for duplicate checking)
 */
export async function getCustomerByPhone(pool: Pool, phone: string, excludeId?: string): Promise<CustomerRow | null> {
  let query = `
    SELECT * FROM customers
    WHERE phone = $1 AND is_active = true
  `;
  const values: any[] = [phone];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<CustomerRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get customer by phone', { phone, error });
    throw error;
  }
}

/**
 * Get customer by name (for duplicate checking)
 * Case-insensitive exact match on active customers only
 */
export async function getCustomerByName(pool: Pool, name: string, excludeId?: string): Promise<CustomerRow | null> {
  let query = `
    SELECT * FROM customers
    WHERE LOWER(name) = LOWER($1) AND is_active = true
  `;
  const values: any[] = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<CustomerRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get customer by name', { name, error });
    throw error;
  }
}

/**
 * Get customer by email (for duplicate checking)
 */
export async function getCustomerByEmail(pool: Pool, email: string, excludeId?: string): Promise<CustomerRow | null> {
  let query = `
    SELECT * FROM customers
    WHERE LOWER(email) = LOWER($1) AND is_active = true
  `;
  const values: any[] = [email];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<CustomerRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get customer by email', { email, error });
    throw error;
  }
}

/**
 * Create customer
 */
export async function createCustomer(pool: Pool, params: CreateCustomerParams): Promise<CustomerRow> {
  const query = `
    INSERT INTO customers (
      name, email, phone, address, customer_group_id, credit_limit, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  try {
    const result = await pool.query<CustomerRow>(query, [
      params.name,
      params.email || null,
      params.phone || null,
      params.address || null,
      params.customerGroupId || null,
      params.creditLimit || 0,
      params.notes || null,
    ]);

    logger.info('Customer created', { customerId: result.rows[0].id, name: params.name });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create customer', { name: params.name, error });
    throw error;
  }
}

/**
 * Update customer
 */
export async function updateCustomer(
  pool: Pool,
  id: string,
  params: UpdateCustomerParams
): Promise<CustomerRow> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(params.name);
  }

  if (params.email !== undefined) {
    updates.push(`email = $${paramIndex++}`);
    values.push(params.email);
  }

  if (params.phone !== undefined) {
    updates.push(`phone = $${paramIndex++}`);
    values.push(params.phone);
  }

  if (params.address !== undefined) {
    updates.push(`address = $${paramIndex++}`);
    values.push(params.address);
  }

  if (params.customerGroupId !== undefined) {
    updates.push(`customer_group_id = $${paramIndex++}`);
    values.push(params.customerGroupId);
  }

  if (params.creditLimit !== undefined) {
    updates.push(`credit_limit = $${paramIndex++}`);
    values.push(params.creditLimit);
  }

  if (params.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }

  if (params.notes !== undefined) {
    updates.push(`notes = $${paramIndex++}`);
    values.push(params.notes);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `
    UPDATE customers
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await pool.query<CustomerRow>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Customer not found');
    }

    logger.info('Customer updated', { customerId: id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update customer', { id, error });
    throw error;
  }
}

/**
 * Delete customer (soft delete)
 */
export async function deleteCustomer(pool: Pool, id: string): Promise<void> {
  const query = `
    UPDATE customers
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new Error('Customer not found');
    }

    logger.info('Customer deactivated', { customerId: id });
  } catch (error) {
    logger.error('Failed to delete customer', { id, error });
    throw error;
  }
}

/**
 * Get customers with outstanding balance
 */
export async function getCustomersWithBalance(pool: Pool): Promise<CustomerWithGroupRow[]> {
  const query = `
    SELECT 
      c.*,
      cg.name as group_name
    FROM customers c
    LEFT JOIN customer_groups cg ON c.customer_group_id = cg.id
    WHERE c.balance < 0 AND c.is_active = true
    ORDER BY c.balance
  `;

  try {
    const result = await pool.query<CustomerWithGroupRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get customers with balance', error);
    throw error;
  }
}

/**
 * Get customer transaction history
 */
export async function getCustomerTransactions(pool: Pool, customerId: string): Promise<any[]> {
  const query = `
    SELECT 
      'SALE' as type,
      s.sale_number as reference_number,
      s.sale_date as transaction_date,
      s.total_amount as debit,
      0 as credit,
      s.payment_method,
      s.notes as description,
      s.created_at
    FROM sales s
    WHERE s.customer_id = $1 AND s.status = 'COMPLETED'
    
    UNION ALL
    
    SELECT 
      'PAYMENT' as type,
      ip.receipt_number as reference_number,
      ip.payment_date as transaction_date,
      0 as debit,
      ip.amount as credit,
      ip.payment_method,
      COALESCE(ip.notes, 'Payment for ' || i.invoice_number) as description,
      ip.created_at
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    WHERE i.customer_id = $1
    
    ORDER BY transaction_date DESC, created_at DESC
  `;

  try {
    const result = await pool.query(query, [customerId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get customer transactions', { customerId, error });
    throw error;
  }
}

/**
 * Get customer ledger (full account statement with running balance)
 * Similar to QuickBooks customer statement
 */
export async function getCustomerLedger(
  pool: Pool, 
  customerId: string,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let dateFilter = '';
  const values: any[] = [customerId];
  let paramIndex = 2;

  if (startDate) {
    dateFilter += ` AND transaction_date >= $${paramIndex++}`;
    values.push(startDate);
  }
  if (endDate) {
    dateFilter += ` AND transaction_date <= $${paramIndex++}`;
    values.push(endDate);
  }

  const query = `
    WITH transactions AS (
      -- Invoices created (debit - customer owes)
      SELECT 
        'INVOICE' as type,
        i.invoice_number as reference_number,
        i.issue_date as transaction_date,
        i.total_amount as debit,
        0::numeric as credit,
        'Invoice from ' || COALESCE(s.sale_number, 'direct') as description,
        i.created_at
      FROM invoices i
      LEFT JOIN sales s ON i.sale_id = s.id
      WHERE i.customer_id = $1 AND i.status != 'CANCELLED'
      
      UNION ALL
      
      -- Payments received (credit - customer pays)
      SELECT 
        'PAYMENT' as type,
        ip.receipt_number as reference_number,
        ip.payment_date as transaction_date,
        0::numeric as debit,
        ip.amount as credit,
        ip.payment_method || ' payment - ' || i.invoice_number as description,
        ip.created_at
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      WHERE i.customer_id = $1
    )
    SELECT 
      type,
      reference_number,
      transaction_date,
      debit,
      credit,
      description,
      created_at,
      SUM(debit - credit) OVER (ORDER BY transaction_date, created_at ROWS UNBOUNDED PRECEDING) as running_balance
    FROM transactions
    WHERE 1=1 ${dateFilter}
    ORDER BY transaction_date ASC, created_at ASC
  `;

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get customer ledger', { customerId, error });
    throw error;
  }
}

/**
 * Get customer account summary (like QuickBooks)
 */
export async function getCustomerAccountSummary(pool: Pool, customerId: string): Promise<any> {
  const query = `
    WITH stats AS (
      SELECT 
        -- Total invoiced (all time)
        COALESCE(SUM(CASE WHEN i.status != 'CANCELLED' THEN i.total_amount ELSE 0 END), 0) as total_invoiced,
        -- Total paid (all time)
        COALESCE((
          SELECT SUM(ip.amount) 
          FROM invoice_payments ip 
          JOIN invoices inv ON ip.invoice_id = inv.id 
          WHERE inv.customer_id = $1
        ), 0) as total_paid,
        -- Count invoices by status
        COUNT(CASE WHEN i.status = 'PAID' THEN 1 END) as paid_invoice_count,
        COUNT(CASE WHEN i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID') THEN 1 END) as open_invoice_count,
        COUNT(CASE WHEN i.status = 'OVERDUE' OR (i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID') AND i.due_date < CURRENT_DATE) THEN 1 END) as overdue_invoice_count
      FROM invoices i
      WHERE i.customer_id = $1
    ),
    aging AS (
      SELECT
        COALESCE(SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.amount_due ELSE 0 END), 0) as current_due,
        COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30 THEN i.amount_due ELSE 0 END), 0) as overdue_1_30,
        COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60 THEN i.amount_due ELSE 0 END), 0) as overdue_31_60,
        COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90 THEN i.amount_due ELSE 0 END), 0) as overdue_61_90,
        COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 90 THEN i.amount_due ELSE 0 END), 0) as overdue_over_90
      FROM invoices i
      WHERE i.customer_id = $1 AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
    ),
    recent_activity AS (
      SELECT 
        (SELECT MAX(s.sale_date) FROM sales s WHERE s.customer_id = $1) as last_sale_date,
        (SELECT MAX(ip.payment_date) FROM invoice_payments ip JOIN invoices i ON ip.invoice_id = i.id WHERE i.customer_id = $1) as last_payment_date
    )
    SELECT 
      s.total_invoiced,
      s.total_paid,
      s.total_invoiced - s.total_paid as total_outstanding,
      s.paid_invoice_count,
      s.open_invoice_count,
      s.overdue_invoice_count,
      a.current_due,
      a.overdue_1_30,
      a.overdue_31_60,
      a.overdue_61_90,
      a.overdue_over_90,
      r.last_sale_date,
      r.last_payment_date
    FROM stats s, aging a, recent_activity r
  `;

  try {
    const result = await pool.query(query, [customerId]);
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to get customer account summary', { customerId, error });
    throw error;
  }
}
