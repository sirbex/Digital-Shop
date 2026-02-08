import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface ProductRow {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit_of_measure: string;
  conversion_factor: string;
  cost_price: string;
  selling_price: string;
  costing_method: 'FIFO' | 'AVCO' | 'STANDARD';
  average_cost: string;
  last_cost: string;
  pricing_formula: string | null;
  auto_update_price: boolean;
  quantity_on_hand: string;
  reorder_level: string;
  track_expiry: boolean;
  is_taxable: boolean;
  tax_rate: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductParams {
  sku?: string; // Now optional - will be auto-generated if not provided
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  conversionFactor?: number;
  costPrice: number;
  sellingPrice: number;
  costingMethod?: 'FIFO' | 'AVCO' | 'STANDARD';
  pricingFormula?: string;
  autoUpdatePrice?: boolean;
  reorderLevel?: number;
  trackExpiry?: boolean;
  isTaxable?: boolean;
  taxRate?: number;
}

export interface UpdateProductParams {
  sku?: string;
  barcode?: string;
  name?: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  conversionFactor?: number;
  costPrice?: number;
  sellingPrice?: number;
  costingMethod?: 'FIFO' | 'AVCO' | 'STANDARD';
  pricingFormula?: string;
  autoUpdatePrice?: boolean;
  reorderLevel?: number;
  trackExpiry?: boolean;
  isTaxable?: boolean;
  taxRate?: number;
  isActive?: boolean;
}

/**
 * Get all products
 */
export async function getAllProducts(pool: Pool, filters?: {
  category?: string;
  trackExpiry?: boolean;
  search?: string;
  isActive?: boolean;
}): Promise<ProductRow[]> {
  let query = 'SELECT * FROM products WHERE 1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.category) {
    query += ` AND category = $${paramIndex++}`;
    params.push(filters.category);
  }

  if (filters?.trackExpiry !== undefined) {
    query += ` AND track_expiry = $${paramIndex++}`;
    params.push(filters.trackExpiry);
  }

  if (filters?.search) {
    query += ` AND (name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  if (filters?.isActive !== undefined) {
    query += ` AND is_active = $${paramIndex++}`;
    params.push(filters.isActive);
  }

  query += ' ORDER BY name';

  try {
    const result = await pool.query<ProductRow>(query, params);
    return result.rows;
  } catch (error) {
    console.error('Failed to get all products', error);
    throw error;
  }
}

/**
 * Get product by ID
 */
export async function getProductById(pool: Pool, id: string): Promise<ProductRow | null> {
  const query = 'SELECT * FROM products WHERE id = $1';

  try {
    const result = await pool.query<ProductRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get product by ID', { id, error });
    throw error;
  }
}

/**
 * Get product by SKU
 */
export async function getProductBySku(pool: Pool, sku: string): Promise<ProductRow | null> {
  const query = 'SELECT * FROM products WHERE sku = $1';

  try {
    const result = await pool.query<ProductRow>(query, [sku]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get product by SKU', { sku, error });
    throw error;
  }
}

/**
 * Get product by barcode
 */
export async function getProductByBarcode(pool: Pool, barcode: string): Promise<ProductRow | null> {
  const query = 'SELECT * FROM products WHERE barcode = $1';

  try {
    const result = await pool.query<ProductRow>(query, [barcode]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get product by barcode', { barcode, error });
    throw error;
  }
}

/**
 * Get product by name (for duplicate checking)
 * Case-insensitive exact match on active products only
 */
export async function getProductByName(pool: Pool, name: string, excludeId?: string): Promise<ProductRow | null> {
  let query = `
    SELECT * FROM products
    WHERE LOWER(name) = LOWER($1) AND is_active = true
  `;
  const values: any[] = [name];

  if (excludeId) {
    query += ` AND id != $2`;
    values.push(excludeId);
  }
  query += ` LIMIT 1`;

  try {
    const result = await pool.query<ProductRow>(query, values);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get product by name', { name, error });
    throw error;
  }
}

/**
 * Generate next SKU number (PRD-00001 format)
 */
export async function generateSku(pool: Pool): Promise<string> {
  const query = `
    SELECT sku FROM products 
    WHERE sku LIKE 'PRD-%'
    ORDER BY sku DESC 
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    
    if (result.rows.length === 0) {
      return 'PRD-00001';
    }

    const lastSku = result.rows[0].sku;
    const lastNumber = parseInt(lastSku.replace('PRD-', ''), 10);
    const nextNumber = (lastNumber + 1).toString().padStart(5, '0');
    
    return `PRD-${nextNumber}`;
  } catch (error) {
    logger.error('Failed to generate SKU', { error });
    throw error;
  }
}

/**
 * Create product
 */
export async function createProduct(pool: Pool, params: CreateProductParams): Promise<ProductRow> {
  // Auto-generate SKU if not provided
  const sku = params.sku || await generateSku(pool);
  
  const query = `
    INSERT INTO products (
      sku, barcode, name, description, category,
      unit_of_measure, conversion_factor,
      cost_price, selling_price, costing_method,
      pricing_formula, auto_update_price,
      reorder_level, track_expiry,
      is_taxable, tax_rate
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *
  `;

  try {
    const result = await pool.query<ProductRow>(query, [
      sku,
      params.barcode || null,
      params.name,
      params.description || null,
      params.category || null,
      params.unitOfMeasure || 'PCS',
      params.conversionFactor || 1.0,
      params.costPrice,
      params.sellingPrice,
      params.costingMethod || 'FIFO',
      params.pricingFormula || null,
      params.autoUpdatePrice || false,
      params.reorderLevel || 0,
      params.trackExpiry || false,
      params.isTaxable !== undefined ? params.isTaxable : true,
      params.taxRate || 0.06,
    ]);

    logger.info('Product created', { productId: result.rows[0].id, sku });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create product', { sku, error });
    throw error;
  }
}

/**
 * Update product
 */
export async function updateProduct(
  pool: Pool,
  id: string,
  params: UpdateProductParams
): Promise<ProductRow> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (params.sku !== undefined) {
    updates.push(`sku = $${paramIndex++}`);
    values.push(params.sku);
  }

  if (params.barcode !== undefined) {
    updates.push(`barcode = $${paramIndex++}`);
    values.push(params.barcode);
  }

  if (params.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(params.name);
  }

  if (params.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(params.description);
  }

  if (params.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(params.category);
  }

  if (params.unitOfMeasure !== undefined) {
    updates.push(`unit_of_measure = $${paramIndex++}`);
    values.push(params.unitOfMeasure);
  }

  if (params.conversionFactor !== undefined) {
    updates.push(`conversion_factor = $${paramIndex++}`);
    values.push(params.conversionFactor);
  }

  if (params.costPrice !== undefined) {
    updates.push(`cost_price = $${paramIndex++}`);
    values.push(params.costPrice);
  }

  if (params.sellingPrice !== undefined) {
    updates.push(`selling_price = $${paramIndex++}`);
    values.push(params.sellingPrice);
  }

  if (params.costingMethod !== undefined) {
    updates.push(`costing_method = $${paramIndex++}`);
    values.push(params.costingMethod);
  }

  if (params.pricingFormula !== undefined) {
    updates.push(`pricing_formula = $${paramIndex++}`);
    values.push(params.pricingFormula);
  }

  if (params.autoUpdatePrice !== undefined) {
    updates.push(`auto_update_price = $${paramIndex++}`);
    values.push(params.autoUpdatePrice);
  }

  if (params.reorderLevel !== undefined) {
    updates.push(`reorder_level = $${paramIndex++}`);
    values.push(params.reorderLevel);
  }

  if (params.trackExpiry !== undefined) {
    updates.push(`track_expiry = $${paramIndex++}`);
    values.push(params.trackExpiry);
  }

  if (params.isTaxable !== undefined) {
    updates.push(`is_taxable = $${paramIndex++}`);
    values.push(params.isTaxable);
  }

  if (params.taxRate !== undefined) {
    updates.push(`tax_rate = $${paramIndex++}`);
    values.push(params.taxRate);
  }

  if (params.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `
    UPDATE products
    SET ${updates.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await pool.query<ProductRow>(query, values);

    if (result.rows.length === 0) {
      throw new Error('Product not found');
    }

    logger.info('Product updated', { productId: id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update product', { id, error });
    throw error;
  }
}

/**
 * Delete product (soft delete)
 */
export async function deleteProduct(pool: Pool, id: string): Promise<void> {
  const query = `
    UPDATE products
    SET is_active = false, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `;

  try {
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new Error('Product not found');
    }

    logger.info('Product deleted', { productId: id });
  } catch (error) {
    logger.error('Failed to delete product', { id, error });
    throw error;
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(pool: Pool): Promise<ProductRow[]> {
  const query = `
    SELECT * FROM products
    WHERE is_active = true
      AND quantity_on_hand <= reorder_level
    ORDER BY quantity_on_hand
  `;

  try {
    const result = await pool.query<ProductRow>(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get low stock products', error);
    throw error;
  }
}

