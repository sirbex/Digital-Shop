import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface SupplierRow {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  balance: string;
  payment_terms: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierParams {
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateSupplierParams {
  name?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentTerms?: string;
  isActive?: boolean;
  notes?: string;
}

/**
 * Get all suppliers
 */
export async function getAllSuppliers(pool: Pool): Promise<SupplierRow[]> {
  const query = `
    SELECT *
    FROM suppliers
    ORDER BY name
  `;

  try {
    const result = await pool.query<SupplierRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get all suppliers', error);
    throw error;
  }
}

/**
 * Get supplier by ID
 */
export async function getSupplierById(pool: Pool, id: string): Promise<SupplierRow | null> {
  const query = `
    SELECT *
    FROM suppliers
    WHERE id = $1
  `;

  try {
    const result = await pool.query<SupplierRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get supplier by ID', { id, error });
    throw error;
  }
}

/**
 * Search suppliers by name, email, or phone
 */
export async function searchSuppliers(pool: Pool, search: string): Promise<SupplierRow[]> {
  const query = `
    SELECT *
    FROM suppliers
    WHERE name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
    ORDER BY name
    LIMIT 50
  `;

  try {
    const result = await pool.query<SupplierRow>(query, [`%${search}%`]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to search suppliers', { search, error });
    throw error;
  }
}

/**
 * Get supplier by phone number (for duplicate checking)
 */
export async function getSupplierByPhone(pool: Pool, phone: string, excludeId?: string): Promise<SupplierRow | null> {
  let query = `
    SELECT * FROM suppliers
    WHERE phone = $1 AND is_active = true
  `;
  const values: any[] = [phone];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<SupplierRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get supplier by phone', { phone, error });
    throw error;
  }
}

/**
 * Get supplier by email (for duplicate checking)
 */
export async function getSupplierByEmail(pool: Pool, email: string, excludeId?: string): Promise<SupplierRow | null> {
  let query = `
    SELECT * FROM suppliers
    WHERE LOWER(email) = LOWER($1) AND is_active = true
  `;
  const values: any[] = [email];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<SupplierRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get supplier by email', { email, error });
    throw error;
  }
}

/**
 * Create supplier
 */
export async function createSupplier(pool: Pool, params: CreateSupplierParams): Promise<SupplierRow> {
  const query = `
    INSERT INTO suppliers (
      name, contact_person, email, phone, address, payment_terms, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  try {
    const result = await pool.query<SupplierRow>(query, [
      params.name,
      params.contactPerson || null,
      params.email || null,
      params.phone || null,
      params.address || null,
      params.paymentTerms || null,
      params.notes || null,
    ]);

    logger.info('Supplier created', { supplierId: result.rows[0].id, name: params.name });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create supplier', { name: params.name, error });
    throw error;
  }
}

/**
 * Update supplier
 */
export async function updateSupplier(
  pool: Pool,
  id: string,
  params: UpdateSupplierParams
): Promise<SupplierRow> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(params.name);
  }

  if (params.contactPerson !== undefined) {
    updates.push(`contact_person = $${paramIndex++}`);
    values.push(params.contactPerson);
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

  if (params.paymentTerms !== undefined) {
    updates.push(`payment_terms = $${paramIndex++}`);
    values.push(params.paymentTerms);
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
    UPDATE suppliers
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await pool.query<SupplierRow>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Supplier not found');
    }

    logger.info('Supplier updated', { supplierId: id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update supplier', { id, error });
    throw error;
  }
}

/**
 * Delete supplier (soft delete)
 */
export async function deleteSupplier(pool: Pool, id: string): Promise<void> {
  const query = `
    UPDATE suppliers
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new Error('Supplier not found');
    }

    logger.info('Supplier deactivated', { supplierId: id });
  } catch (error) {
    logger.error('Failed to delete supplier', { id, error });
    throw error;
  }
}

/**
 * Get suppliers with payables (positive balance = we owe them)
 */
export async function getSuppliersWithPayables(pool: Pool): Promise<SupplierRow[]> {
  const query = `
    SELECT *
    FROM suppliers
    WHERE balance > 0 AND is_active = true
    ORDER BY balance DESC
  `;

  try {
    const result = await pool.query<SupplierRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get suppliers with payables', error);
    throw error;
  }
}

/**
 * Get supplier transaction history
 */
export async function getSupplierTransactions(pool: Pool, supplierId: string): Promise<any[]> {
  const query = `
    SELECT 
      'PURCHASE' as type,
      po.order_number as reference_number,
      po.order_date as transaction_date,
      po.total_amount as amount,
      po.status,
      po.created_at
    FROM purchase_orders po
    WHERE po.supplier_id = $1
    
    ORDER BY transaction_date DESC
  `;

  try {
    const result = await pool.query(query, [supplierId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get supplier transactions', { supplierId, error });
    throw error;
  }
}

