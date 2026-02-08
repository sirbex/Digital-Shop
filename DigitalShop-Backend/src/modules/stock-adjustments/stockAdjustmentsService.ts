import { Pool } from 'pg';
import * as stockAdjustmentsRepository from './stockAdjustmentsRepository.js';
import { logger } from '../../utils/logger.js';

/**
 * Stock Adjustments Service
 * 
 * Stock adjustments are tracked via stock_movements table using movement types:
 * ADJUSTMENT_IN, ADJUSTMENT_OUT, DAMAGE, EXPIRY, RETURN
 */

export type AdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRY' | 'RETURN';

export interface StockAdjustment {
  id: string;
  movementNumber: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  batchId: string | null;
  batchNumber: string | null;
  adjustmentType: AdjustmentType;
  quantity: number;
  unitCost: number | null;
  reason: string | null;
  notes: string | null;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CreateStockAdjustmentData {
  productId: string;
  batchId?: string;
  adjustmentType: AdjustmentType;
  quantity: number;
  unitCost?: number;
  reason: string;
  notes?: string;
  createdById: string;
}

/**
 * Convert database row to StockAdjustment object
 */
function toStockAdjustment(row: stockAdjustmentsRepository.StockAdjustmentRow): StockAdjustment {
  return {
    id: row.id,
    movementNumber: row.movement_number,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    adjustmentType: row.movement_type as AdjustmentType,
    quantity: Math.abs(parseFloat(row.quantity)), // Always positive in response
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    reason: row.notes, // Notes contain the reason
    notes: row.notes,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

/**
 * Create a stock adjustment
 */
export async function createStockAdjustment(data: CreateStockAdjustmentData): Promise<StockAdjustment> {
  try {
    const adjustment = await stockAdjustmentsRepository.createStockAdjustment({
      productId: data.productId,
      batchId: data.batchId,
      adjustmentType: data.adjustmentType,
      quantity: data.quantity,
      unitCost: data.unitCost,
      reason: data.reason,
      notes: data.notes,
      createdById: data.createdById,
    });

    logger.info(`Stock adjustment created: ${adjustment.movement_number}`, {
      adjustmentId: adjustment.id,
      productId: data.productId,
      adjustmentType: data.adjustmentType,
      quantity: data.quantity,
      userId: data.createdById,
    });

    return toStockAdjustment(adjustment);
  } catch (error: any) {
    logger.error('Failed to create stock adjustment:', error);
    throw error;
  }
}

/**
 * Get stock adjustment by ID
 */
export async function getStockAdjustmentById(adjustmentId: string): Promise<StockAdjustment> {
  const adjustment = await stockAdjustmentsRepository.findStockAdjustmentById(adjustmentId);

  if (!adjustment) {
    throw new Error('Stock adjustment not found');
  }

  return toStockAdjustment(adjustment);
}

/**
 * Get all stock adjustments with optional filters
 */
export async function getAllStockAdjustments(filters?: {
  productId?: string;
  adjustmentType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<StockAdjustment[]> {
  const rows = await stockAdjustmentsRepository.findAllStockAdjustments(filters);
  return rows.map(toStockAdjustment);
}

/**
 * Get stock adjustments summary statistics
 */
export async function getStockAdjustmentsSummary() {
  return await stockAdjustmentsRepository.getStockAdjustmentsSummary();
}

// ============================================================================
// SamplePOS-compatible methods
// ============================================================================

/**
 * List stock adjustments with pagination
 */
export async function listStockAdjustments(
  dbPool: Pool,
  page: number = 1,
  limit: number = 50,
  filters?: {
    productId?: string;
    adjustmentType?: string;
  }
): Promise<{ adjustments: StockAdjustment[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = "sm.movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN')";
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.productId) {
    whereClause += ` AND sm.product_id = $${paramIndex}`;
    params.push(filters.productId);
    paramIndex++;
  }

  if (filters?.adjustmentType) {
    whereClause += ` AND sm.movement_type = $${paramIndex}`;
    params.push(filters.adjustmentType);
    paramIndex++;
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM stock_movements sm
    WHERE ${whereClause}
  `;
  const countResult = await dbPool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Get paginated results
  const query = `
    SELECT 
      sm.id,
      sm.movement_number,
      sm.product_id,
      p.name AS product_name,
      p.sku,
      sm.batch_id,
      ib.batch_number,
      sm.movement_type,
      sm.quantity,
      sm.unit_cost,
      sm.reference_type,
      sm.reference_id,
      sm.notes,
      sm.created_by_id,
      u.full_name AS created_by_name,
      sm.created_at
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    LEFT JOIN inventory_batches ib ON sm.batch_id = ib.id
    LEFT JOIN users u ON sm.created_by_id = u.id
    WHERE ${whereClause}
    ORDER BY sm.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await dbPool.query(query, [...params, limit, offset]);

  const adjustments = result.rows.map((row: any) => ({
    id: row.id,
    movementNumber: row.movement_number,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    adjustmentType: row.movement_type as AdjustmentType,
    quantity: Math.abs(parseFloat(row.quantity || '0')),
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    reason: row.notes,
    notes: row.notes,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }));

  return { adjustments, total };
}

/**
 * Create stock adjustment (V2 - SamplePOS compatible)
 */
export async function createStockAdjustmentV2(
  dbPool: Pool,
  data: {
    productId: string;
    batchId?: string;
    adjustmentType: AdjustmentType;
    quantity: number;
    unitCost?: number;
    reason: string;
    notes?: string;
  },
  userId: string
): Promise<StockAdjustment> {
  return await createStockAdjustment({
    ...data,
    createdById: userId,
  });
}

/**
 * Get available adjustment types
 */
export function getAdjustmentTypes(): { value: string; label: string; direction: 'IN' | 'OUT' }[] {
  return [
    { value: 'ADJUSTMENT_IN', label: 'Adjustment (In)', direction: 'IN' },
    { value: 'ADJUSTMENT_OUT', label: 'Adjustment (Out)', direction: 'OUT' },
    { value: 'DAMAGE', label: 'Damage', direction: 'OUT' },
    { value: 'EXPIRY', label: 'Expiry', direction: 'OUT' },
    { value: 'RETURN', label: 'Return', direction: 'IN' },
  ];
}
