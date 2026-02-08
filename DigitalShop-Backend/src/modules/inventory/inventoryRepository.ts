import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface InventoryBatchRow {
  id: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  batch_number: string;
  source_type: string | null;
  quantity: string;
  remaining_quantity: string;
  cost_price: string;
  expiry_date: string | null;
  received_date: string;
  status: string;
}

export interface StockMovementRow {
  id: string;
  product_id: string;
  product_name: string | null;
  batch_id: string | null;
  batch_number: string | null;
  movement_type: string;
  quantity: string;
  cost_price: string | null;
  reference_type: string | null;
  reference_id: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
}

export interface CreateBatchParams {
  productId: string;
  batchNumber: string;
  sourceId?: string;
  sourceType?: string;
  quantity: number;
  remainingQuantity: number;
  costPrice: number;
  expiryDate?: string;
  receivedDate: string;
}

export interface CreateStockMovementParams {
  productId: string;
  batchId?: string;
  movementType: string;
  quantity: number;
  unitCost?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy: string;
}

/**
 * Get all inventory batches with filters
 */
export async function getAllBatches(
  pool: Pool,
  filters?: {
    productId?: string;
    status?: string;
    expiringSoon?: boolean;
    daysToExpiry?: number;
  }
): Promise<InventoryBatchRow[]> {
  let query = `
    SELECT 
      ib.id,
      ib.batch_number,
      ib.product_id,
      ib.quantity,
      ib.remaining_quantity,
      ib.cost_price,
      ib.expiry_date,
      ib.received_date,
      ib.status,
      ib.source_type,
      p.name as product_name,
      p.sku
    FROM inventory_batches ib
    JOIN products p ON ib.product_id = p.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.productId) {
    query += ` AND ib.product_id = $${paramIndex++}`;
    values.push(filters.productId);
  }

  if (filters?.status) {
    query += ` AND ib.status = $${paramIndex++}`;
    values.push(filters.status);
  }

  if (filters?.expiringSoon) {
    const days = filters.daysToExpiry || 30;
    query += ` AND ib.expiry_date IS NOT NULL`;
    query += ` AND ib.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'`;
    query += ` AND ib.expiry_date > CURRENT_DATE`;
    query += ` AND ib.status = 'ACTIVE'`;
  }

  query += ' ORDER BY ib.expiry_date NULLS LAST, ib.received_date';

  try {
    const result = await pool.query<InventoryBatchRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all batches', { filters, error });
    throw error;
  }
}

/**
 * Get batch by ID
 */
export async function getBatchById(pool: Pool, id: string): Promise<InventoryBatchRow | null> {
  const query = `
    SELECT 
      ib.id,
      ib.batch_number,
      ib.product_id,
      ib.quantity,
      ib.remaining_quantity,
      ib.cost_price,
      ib.expiry_date,
      ib.received_date,
      ib.status,
      ib.source_type,
      p.name as product_name,
      p.sku
    FROM inventory_batches ib
    JOIN products p ON ib.product_id = p.id
    WHERE ib.id = $1
  `;

  try {
    const result = await pool.query<InventoryBatchRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get batch by ID', { id, error });
    throw error;
  }
}

/**
 * Get available batches for FEFO selection
 */
export async function getAvailableBatchesForProduct(
  pool: Pool,
  productId: string
): Promise<InventoryBatchRow[]> {
  const query = `
    SELECT 
      ib.id,
      ib.batch_number,
      ib.product_id,
      ib.quantity,
      ib.remaining_quantity,
      ib.cost_price,
      ib.expiry_date,
      ib.received_date,
      ib.status,
      ib.source_type,
      p.name as product_name,
      p.sku
    FROM inventory_batches ib
    JOIN products p ON ib.product_id = p.id
    WHERE ib.product_id = $1
      AND ib.status = 'ACTIVE'
      AND ib.remaining_quantity > 0
    ORDER BY ib.expiry_date NULLS LAST, ib.received_date
  `;

  try {
    const result = await pool.query<InventoryBatchRow>(query, [productId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get available batches', { productId, error });
    throw error;
  }
}

/**
 * Create inventory batch
 */
export async function createBatch(pool: Pool, params: CreateBatchParams): Promise<InventoryBatchRow> {
  const query = `
    INSERT INTO inventory_batches (
      product_id, batch_number, source_type, quantity,
      remaining_quantity, cost_price, expiry_date, received_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  try {
    const result = await pool.query<InventoryBatchRow>(query, [
      params.productId,
      params.batchNumber,
      params.sourceType || null,
      params.quantity,
      params.remainingQuantity,
      params.costPrice,
      params.expiryDate || null,
      params.receivedDate,
    ]);

    logger.info('Inventory batch created', { 
      batchId: result.rows[0].id, 
      batchNumber: params.batchNumber 
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create batch', { params, error });
    throw error;
  }
}

/**
 * Update batch remaining quantity
 */
export async function updateBatchQuantity(
  pool: Pool,
  batchId: string,
  quantityChange: number
): Promise<void> {
  const query = `
    UPDATE inventory_batches
    SET remaining_quantity = remaining_quantity + $1,
        status = CASE 
          WHEN remaining_quantity + $1 <= 0 THEN 'DEPLETED'
          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  try {
    await pool.query(query, [quantityChange, batchId]);
    logger.info('Batch quantity updated', { batchId, quantityChange });
  } catch (error) {
    logger.error('Failed to update batch quantity', { batchId, quantityChange, error });
    throw error;
  }
}

/**
 * Get stock movements
 */
export async function getStockMovements(
  pool: Pool,
  filters?: {
    productId?: string;
    batchId?: string;
    movementType?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<StockMovementRow[]> {
  let query = `
    SELECT 
      sm.*,
      p.name as product_name,
      ib.batch_number,
      u.full_name as created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN inventory_batches ib ON sm.batch_id = ib.id
    LEFT JOIN users u ON sm.created_by = u.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.productId) {
    query += ` AND sm.product_id = $${paramIndex++}`;
    values.push(filters.productId);
  }

  if (filters?.batchId) {
    query += ` AND sm.batch_id = $${paramIndex++}`;
    values.push(filters.batchId);
  }

  if (filters?.movementType) {
    query += ` AND sm.movement_type = $${paramIndex++}`;
    values.push(filters.movementType);
  }

  if (filters?.startDate) {
    query += ` AND sm.created_at >= $${paramIndex++}`;
    values.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ` AND sm.created_at <= $${paramIndex++}`;
    values.push(filters.endDate);
  }

  query += ' ORDER BY sm.created_at DESC';

  try {
    const result = await pool.query<StockMovementRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get stock movements', { filters, error });
    throw error;
  }
}

/**
 * Create stock movement
 */
export async function createStockMovement(
  pool: Pool,
  params: CreateStockMovementParams
): Promise<StockMovementRow> {
  const query = `
    INSERT INTO stock_movements (
      product_id, batch_id, movement_type, quantity, unit_cost,
      reference_type, reference_id, reference_number, notes, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  try {
    const result = await pool.query<StockMovementRow>(query, [
      params.productId,
      params.batchId || null,
      params.movementType,
      params.quantity,
      params.unitCost || null,
      params.referenceType || null,
      params.referenceId || null,
      params.referenceNumber || null,
      params.notes || null,
      params.createdBy,
    ]);

    logger.info('Stock movement created', { 
      movementId: result.rows[0].id,
      type: params.movementType,
      quantity: params.quantity
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create stock movement', { params, error });
    throw error;
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(pool: Pool): Promise<any[]> {
  const query = `
    SELECT 
      p.id,
      p.name,
      p.sku,
      p.quantity_on_hand,
      p.reorder_level,
      p.category,
      COALESCE(SUM(ib.remaining_quantity), 0) as total_batch_quantity
    FROM products p
    LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.status = 'ACTIVE'
    WHERE p.quantity_on_hand <= p.reorder_level
      AND p.is_active = true
    GROUP BY p.id, p.name, p.sku, p.quantity_on_hand, p.reorder_level, p.category
    ORDER BY p.quantity_on_hand
  `;

  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Failed to get low stock products', error);
    throw error;
  }
}

/**
 * Get inventory valuation
 */
export async function getInventoryValuation(pool: Pool): Promise<any> {
  const query = `
    SELECT 
      COUNT(DISTINCT p.id) as total_products,
      COALESCE(SUM(ib.remaining_quantity * ib.cost_price), 0) as total_value,
      COALESCE(SUM(ib.remaining_quantity), 0) as total_quantity
    FROM products p
    LEFT JOIN inventory_batches ib ON p.id = ib.product_id AND ib.status = 'ACTIVE'
    WHERE p.is_active = true
  `;

  try {
    const result = await pool.query(query);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to get inventory valuation', error);
    throw error;
  }
}

