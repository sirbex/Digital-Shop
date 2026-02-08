import { Pool } from 'pg';
import Decimal from 'decimal.js';
import { logger } from '../../utils/logger.js';
import * as inventoryRepository from './inventoryRepository.js';

export interface InventoryBatch {
  id: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  batchNumber: string;
  goodsReceiptId: string | null;
  grNumber: string | null;
  quantityReceived: number;
  remainingQuantity: number;
  unitCost: number;
  expiryDate: string | null;
  receivedDate: string;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string | null;
  batchId: string | null;
  batchNumber: string | null;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'TRANSFER';
  quantity: number;
  unitCost: number | null;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
}

export interface StockAdjustmentData {
  productId: string;
  batchId?: string;
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRY' | 'RETURN';
  quantity: number;
  reason: string;
  userId: string;
}

export interface BatchFilters {
  productId?: string;
  status?: string;
  expiringSoon?: boolean;
  daysToExpiry?: number;
}

export interface MovementFilters {
  productId?: string;
  batchId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Convert database row to InventoryBatch object
 */
function toBatch(row: inventoryRepository.InventoryBatchRow): InventoryBatch {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    batchNumber: row.batch_number,
    goodsReceiptId: (row as any).goods_receipt_id || null,
    grNumber: (row as any).gr_number || null,
    quantityReceived: parseFloat((row as any).quantity_received || row.quantity),
    remainingQuantity: parseFloat(row.remaining_quantity),
    unitCost: parseFloat((row as any).unit_cost || row.cost_price),
    expiryDate: row.expiry_date,
    receivedDate: row.received_date,
    status: row.status as any,
    createdAt: (row as any).created_at || null,
    updatedAt: (row as any).updated_at || null,
  };
}

/**
 * Convert database row to StockMovement object
 */
function toMovement(row: inventoryRepository.StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    movementType: row.movement_type as any,
    quantity: parseFloat(row.quantity),
    unitCost: row.cost_price ? parseFloat(row.cost_price) : null,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

/**
 * Get all inventory batches
 */
export async function getAllBatches(pool: Pool, filters?: BatchFilters): Promise<InventoryBatch[]> {
  const rows = await inventoryRepository.getAllBatches(pool, filters);
  return rows.map(toBatch);
}

/**
 * Get batch by ID
 */
export async function getBatchById(pool: Pool, id: string): Promise<InventoryBatch> {
  const row = await inventoryRepository.getBatchById(pool, id);

  if (!row) {
    throw new Error('Batch not found');
  }

  return toBatch(row);
}

/**
 * Get available batches for FEFO selection
 */
export async function getAvailableBatchesForProduct(
  pool: Pool,
  productId: string
): Promise<InventoryBatch[]> {
  const rows = await inventoryRepository.getAvailableBatchesForProduct(pool, productId);
  return rows.map(toBatch);
}

/**
 * Select batch using FEFO (First Expiry First Out) logic
 */
export async function selectBatchForQuantity(
  pool: Pool,
  productId: string,
  requiredQuantity: number
): Promise<{ batchId: string; quantity: number }[]> {
  const batches = await getAvailableBatchesForProduct(pool, productId);

  if (batches.length === 0) {
    throw new Error('No available batches for product');
  }

  const allocations: { batchId: string; quantity: number }[] = [];
  let remainingQuantity = new Decimal(requiredQuantity);

  for (const batch of batches) {
    if (remainingQuantity.lessThanOrEqualTo(0)) {
      break;
    }

    const batchAvailable = new Decimal(batch.remainingQuantity);
    const allocateQuantity = Decimal.min(remainingQuantity, batchAvailable);

    allocations.push({
      batchId: batch.id,
      quantity: allocateQuantity.toNumber(),
    });

    remainingQuantity = remainingQuantity.minus(allocateQuantity);
  }

  if (remainingQuantity.greaterThan(0)) {
    throw new Error(
      `Insufficient stock. Required: ${requiredQuantity}, Available: ${requiredQuantity - remainingQuantity.toNumber()}`
    );
  }

  return allocations;
}

/**
 * Get stock movements
 */
export async function getStockMovements(
  pool: Pool,
  filters?: MovementFilters
): Promise<StockMovement[]> {
  const rows = await inventoryRepository.getStockMovements(pool, filters);
  return rows.map(toMovement);
}

/**
 * Perform stock adjustment
 * CRITICAL: If batch is specified, update batch first - trigger will update product quantity
 *           If no batch, update product directly
 */
export async function performStockAdjustment(
  pool: Pool,
  data: StockAdjustmentData
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Calculate adjustment quantity based on movement type
    let adjustmentQuantity: number;

    // ADJUSTMENT_IN and RETURN add stock; ADJUSTMENT_OUT, DAMAGE, EXPIRY remove stock
    if (data.adjustmentType === 'ADJUSTMENT_IN' || data.adjustmentType === 'RETURN') {
      adjustmentQuantity = data.quantity;
    } else {
      // ADJUSTMENT_OUT, DAMAGE, EXPIRY - subtract
      adjustmentQuantity = -data.quantity;
    }

    // Update batch or product quantity (single source of truth)
    if (data.batchId) {
      // Update batch - trigger will automatically update product.quantity_on_hand
      await inventoryRepository.updateBatchQuantity(client as any, data.batchId, adjustmentQuantity);
      // NOTE: trg_sync_inventory_quantity handles products.quantity_on_hand
    } else {
      // No batch specified - update product directly
      const updateProductQuery = `
        UPDATE products
        SET quantity_on_hand = quantity_on_hand + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await client.query(updateProductQuery, [adjustmentQuantity, data.productId]);
    }

    // Create stock movement record
    await inventoryRepository.createStockMovement(client as any, {
      productId: data.productId,
      batchId: data.batchId,
      movementType: data.adjustmentType,
      quantity: adjustmentQuantity,
      referenceType: 'ADJUSTMENT',
      notes: data.reason,
      createdBy: data.userId,
    });

    await client.query('COMMIT');
    logger.info('Stock adjustment completed', { 
      productId: data.productId, 
      adjustment: adjustmentQuantity,
      batchId: data.batchId,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to perform stock adjustment', { data, error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(pool: Pool): Promise<any[]> {
  const products = await inventoryRepository.getLowStockProducts(pool);

  return products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    quantityOnHand: parseFloat(p.quantity_on_hand),
    reorderLevel: parseFloat(p.reorder_level),
    category: p.category,
    totalBatchQuantity: parseFloat(p.total_batch_quantity),
    shortage: parseFloat(p.reorder_level) - parseFloat(p.quantity_on_hand),
  }));
}

/**
 * Get inventory valuation
 */
export async function getInventoryValuation(pool: Pool): Promise<any> {
  const valuation = await inventoryRepository.getInventoryValuation(pool);

  return {
    totalProducts: parseInt(valuation.total_products),
    totalValue: parseFloat(valuation.total_value),
    totalQuantity: parseFloat(valuation.total_quantity),
  };
}

/**
 * Get expiring batches
 */
export async function getExpiringBatches(pool: Pool, daysToExpiry: number = 30): Promise<InventoryBatch[]> {
  const batches = await getAllBatches(pool, {
    expiringSoon: true,
    daysToExpiry,
  });

  return batches;
}

// =====================================================
// SamplePOS Compatible Methods - Stock Levels API
// =====================================================

/**
 * Calculate expiry urgency level - matches SamplePOS
 */
export function calculateExpiryUrgency(expiryDate: Date | string): 'CRITICAL' | 'WARNING' | 'NORMAL' {
  const daysUntilExpiry = Math.ceil(
    (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry <= 7) return 'CRITICAL';
  if (daysUntilExpiry <= 30) return 'WARNING';
  return 'NORMAL';
}

/**
 * Get batches by product - FEFO order (First Expiry First Out)
 * Matches SamplePOS inventoryService.getBatchesByProduct
 */
export async function getBatchesByProduct(pool: Pool, productId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM inventory_batches
     WHERE product_id = $1 AND remaining_quantity > 0 AND status = 'ACTIVE'
     ORDER BY
       CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
       expiry_date ASC,
       created_at ASC`,
    [productId]
  );
  return result.rows;
}

/**
 * Get batches expiring soon - matches SamplePOS
 */
export async function getBatchesExpiringSoon(pool: Pool, daysThreshold: number = 30): Promise<any[]> {
  const result = await pool.query(
    `SELECT b.*, p.name as product_name
     FROM inventory_batches b
     JOIN products p ON b.product_id = p.id
     WHERE b.expiry_date IS NOT NULL
       AND b.remaining_quantity > 0
       AND b.status = 'ACTIVE'
       AND b.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $1
     ORDER BY b.expiry_date ASC`,
    [daysThreshold]
  );

  return result.rows.map((batch: any) => ({
    ...batch,
    daysUntilExpiry: Math.ceil(
      (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    ),
    urgency: calculateExpiryUrgency(batch.expiry_date),
  }));
}

/**
 * Get stock levels for all products - matches SamplePOS POS product search
 * Includes product details, UoMs, pricing, and earliest expiry date
 * Returns snake_case fields for frontend compatibility
 */
export async function getStockLevels(pool: Pool): Promise<any[]> {
  const result = await pool.query(
    `SELECT
       p.id as product_id,
       p.name as product_name,
       p.sku,
       p.barcode,
       p.category,
       p.selling_price,
       p.is_taxable,
       p.tax_rate,
       COALESCE(NULLIF(p.average_cost, 0), p.cost_price) as average_cost,
       COALESCE(SUM(b.remaining_quantity), p.quantity_on_hand) as total_stock,
       MIN(b.expiry_date) FILTER (WHERE b.expiry_date IS NOT NULL AND b.remaining_quantity > 0) as nearest_expiry,
       p.reorder_level,
       CASE WHEN COALESCE(SUM(b.remaining_quantity), p.quantity_on_hand) <= p.reorder_level THEN true ELSE false END as needs_reorder
     FROM products p
     LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
     WHERE p.is_active = true
     GROUP BY p.id, p.name, p.sku, p.barcode, p.category, p.selling_price, p.is_taxable, p.tax_rate, p.average_cost, p.cost_price, p.reorder_level, p.quantity_on_hand
     HAVING COALESCE(SUM(b.remaining_quantity), p.quantity_on_hand) > 0
     ORDER BY needs_reorder DESC, p.name ASC`
  );
  
  // Transform snake_case to camelCase for frontend
  return result.rows.map(row => ({
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
    category: row.category,
    sellingPrice: parseFloat(row.selling_price) || 0,
    isTaxable: row.is_taxable,
    taxRate: parseFloat(row.tax_rate) || 0,
    averageCost: parseFloat(row.average_cost) || 0,
    totalQuantity: parseInt(row.total_stock) || 0,
    nearestExpiry: row.nearest_expiry,
    reorderLevel: parseInt(row.reorder_level) || 0,
    needsReorder: row.needs_reorder,
  }));
}

/**
 * Get stock level for specific product - matches SamplePOS
 */
export async function getStockLevelByProduct(pool: Pool, productId: string): Promise<any> {
  const result = await pool.query(
    `SELECT
       p.id as product_id,
       p.name as product_name,
       COALESCE(SUM(b.remaining_quantity), p.quantity_on_hand) as total_quantity,
       p.reorder_level,
       CASE WHEN COALESCE(SUM(b.remaining_quantity), p.quantity_on_hand) <= p.reorder_level THEN true ELSE false END as needs_reorder
     FROM products p
     LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
     WHERE p.id = $1 AND p.is_active = true
     GROUP BY p.id, p.name, p.reorder_level, p.quantity_on_hand`,
    [productId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Product ${productId} not found or inactive`);
  }

  return result.rows[0];
}

/**
 * Get products needing reorder - matches SamplePOS
 */
export async function getProductsNeedingReorder(pool: Pool): Promise<any[]> {
  const stockLevels = await getStockLevels(pool);
  return stockLevels.filter((item) => item.needs_reorder);
}

/**
 * Adjust inventory quantity with audit trail - matches SamplePOS
 */
export async function adjustInventory(
  pool: Pool,
  productId: string,
  adjustment: number,
  reason: string,
  userId: string
): Promise<any> {
  if (adjustment === 0) {
    throw new Error('Adjustment amount cannot be zero');
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error('Adjustment reason must be at least 5 characters');
  }

  const movementType = adjustment > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
  const absoluteQuantity = Math.abs(adjustment);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update product quantity_on_hand
    const updateResult = await client.query(
      `UPDATE products 
       SET quantity_on_hand = quantity_on_hand + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING quantity_on_hand`,
      [adjustment, productId]
    );

    if (updateResult.rows.length === 0) {
      throw new Error(`Product ${productId} not found`);
    }

    // Generate movement number
    const movementNumberResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(movement_number FROM 4) AS INTEGER)), 0) + 1 as next_num
       FROM stock_movements 
       WHERE movement_number LIKE 'SM-%'`
    );
    const movementNumber = `SM-${String(movementNumberResult.rows[0].next_num).padStart(6, '0')}`;

    // Create stock movement record
    const movementResult = await client.query(
      `INSERT INTO stock_movements (
        movement_number, product_id, movement_type, quantity,
        reference_type, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, movement_number`,
      [movementNumber, productId, movementType, absoluteQuantity, 'ADJUSTMENT', reason, userId]
    );

    await client.query('COMMIT');

    logger.info('Inventory adjusted successfully', {
      productId,
      adjustment,
      reason,
      userId,
      movementId: movementResult.rows[0].id,
      movementNumber: movementResult.rows[0].movement_number,
    });

    return {
      movementId: movementResult.rows[0].id,
      movementNumber: movementResult.rows[0].movement_number,
      newQuantity: parseFloat(updateResult.rows[0].quantity_on_hand),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Inventory adjustment failed', { productId, adjustment, error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get inventory value by product - matches SamplePOS
 */
export async function getInventoryValue(pool: Pool, productId?: string): Promise<any[]> {
  let query = `
    SELECT
      p.id as product_id,
      p.name as product_name,
      SUM(b.remaining_quantity * b.unit_cost) as inventory_value,
      SUM(b.remaining_quantity) as total_quantity
    FROM products p
    LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.status = 'ACTIVE'
    WHERE p.is_active = true
  `;

  const params: any[] = [];
  if (productId) {
    query += ' AND p.id = $1';
    params.push(productId);
  }

  query += ' GROUP BY p.id, p.name ORDER BY inventory_value DESC NULLS LAST';

  const result = await pool.query(query, params);
  return result.rows;
}
