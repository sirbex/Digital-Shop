import pool from '../../db/pool.js';
import { logger } from '../../utils/logger.js';

/**
 * Stock Adjustments Repository
 * 
 * IMPORTANT: The database does NOT have a separate stock_adjustments table.
 * Stock adjustments are tracked via the stock_movements table with 
 * movement_type values like 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY'.
 * 
 * stock_movements schema:
 *   id, movement_number, product_id, batch_id, movement_type, quantity, 
 *   unit_cost, reference_type, reference_id, notes, created_by_id, created_at
 * 
 * Valid movement_types for adjustments:
 *   'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN'
 */

export interface StockAdjustmentRow {
  id: string;
  movement_number: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  batch_id: string | null;
  batch_number: string | null;
  movement_type: string;
  quantity: string;
  unit_cost: string | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by_id: string | null;
  created_by_name: string | null;
  created_at: string;
}

/**
 * Create a stock adjustment (as a stock movement)
 */
export async function createStockAdjustment(data: {
  productId: string;
  batchId?: string;
  adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGE' | 'EXPIRY' | 'RETURN';
  quantity: number;
  unitCost?: number;
  reason?: string;
  notes?: string;
  createdById: string;
}): Promise<StockAdjustmentRow> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate movement number
    const movementNumber = await generateAdjustmentNumber();

    // For outward adjustments, make quantity negative
    let adjustedQuantity = data.quantity;
    if (['ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY'].includes(data.adjustmentType)) {
      adjustedQuantity = -Math.abs(data.quantity);
    } else {
      adjustedQuantity = Math.abs(data.quantity);
    }

    const combinedNotes = data.reason 
      ? (data.notes ? `${data.reason}\n${data.notes}` : data.reason)
      : data.notes;

    // CRITICAL: Update inventory batches to actually change stock levels
    if (data.adjustmentType === 'ADJUSTMENT_IN') {
      // For ADJUSTMENT_IN: Create or update an inventory batch
      if (data.batchId) {
        // Update existing batch
        await client.query(
          `UPDATE inventory_batches 
           SET quantity = quantity + $1,
               remaining_quantity = remaining_quantity + $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [Math.abs(data.quantity), data.batchId]
        );
      } else {
        // Create new batch for this adjustment
        const batchNumber = `ADJ-${movementNumber}`;
        const costPrice = data.unitCost || 0;

        const batchResult = await client.query(
          `INSERT INTO inventory_batches (
             batch_number, product_id, quantity, remaining_quantity, 
             cost_price, status, received_date, source_type, notes
           )
           VALUES ($1, $2, $3, $3, $4, 'ACTIVE', CURRENT_DATE, 'ADJUSTMENT', $5)
           RETURNING id`,
          [batchNumber, data.productId, Math.abs(data.quantity), costPrice, combinedNotes]
        );

        data.batchId = batchResult.rows[0].id;
      }
    } else {
      // For ADJUSTMENT_OUT, DAMAGE, EXPIRY: Reduce inventory from batch
      if (data.batchId) {
        // Update specific batch
        await client.query(
          `UPDATE inventory_batches 
           SET remaining_quantity = remaining_quantity - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [Math.abs(data.quantity), data.batchId]
        );
      } else {
        // Find first active batch and reduce from it (FIFO)
        const batchResult = await client.query(
          `SELECT id FROM inventory_batches
           WHERE product_id = $1 AND status = 'ACTIVE' AND remaining_quantity > 0
           ORDER BY received_date ASC, created_at ASC
           LIMIT 1`,
          [data.productId]
        );

        if (batchResult.rows.length > 0) {
          data.batchId = batchResult.rows[0].id;
          await client.query(
            `UPDATE inventory_batches 
             SET remaining_quantity = GREATEST(remaining_quantity - $1, 0),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [Math.abs(data.quantity), data.batchId]
          );
        }
      }
    }

    // Create stock movement record
    const query = `
      INSERT INTO stock_movements (
        movement_number, product_id, batch_id, movement_type, quantity, 
        unit_cost, reference_type, notes, created_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'MANUAL_ADJUSTMENT', $7, $8)
      RETURNING 
        id, movement_number, product_id, batch_id, movement_type,
        quantity, unit_cost, reference_type, reference_id, notes,
        created_by_id, created_at
    `;

    const result = await client.query(query, [
      movementNumber,
      data.productId,
      data.batchId || null,
      data.adjustmentType,
      adjustedQuantity,
      data.unitCost || null,
      combinedNotes || null,
      data.createdById,
    ]);

    const row = result.rows[0];

    await client.query('COMMIT');

    // Fetch with product details
    return await findStockAdjustmentById(row.id) as StockAdjustmentRow;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create stock adjustment:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate adjustment/movement number
 */
export async function generateAdjustmentNumber(): Promise<string> {
  const query = `
    SELECT 
      movement_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM stock_movements 
    WHERE movement_number LIKE 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY movement_number DESC 
    LIMIT 1
  `;

  const result = await pool.query(query);

  if (result.rows.length === 0) {
    const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
    const year = yearResult.rows[0].year;
    return `ADJ-${year}-0001`;
  }

  const lastNumber = result.rows[0].movement_number;
  const year = result.rows[0].current_year;
  const sequence = parseInt(lastNumber.split('-')[2]) + 1;
  return `ADJ-${year}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Find stock adjustment by ID
 */
export async function findStockAdjustmentById(adjustmentId: string): Promise<StockAdjustmentRow | null> {
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
    WHERE sm.id = $1
      AND sm.movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN')
  `;

  const result = await pool.query(query, [adjustmentId]);
  return result.rows[0] || null;
}

/**
 * Find all stock adjustments (movements with adjustment types)
 */
export async function findAllStockAdjustments(filters?: {
  productId?: string;
  adjustmentType?: string;
  startDate?: string;
  endDate?: string;
}): Promise<StockAdjustmentRow[]> {
  let query = `
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
    WHERE sm.movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN')
  `;

  const params: any[] = [];
  let paramCount = 1;

  if (filters?.productId) {
    query += ` AND sm.product_id = $${paramCount}`;
    params.push(filters.productId);
    paramCount++;
  }

  if (filters?.adjustmentType) {
    query += ` AND sm.movement_type = $${paramCount}`;
    params.push(filters.adjustmentType);
    paramCount++;
  }

  if (filters?.startDate) {
    query += ` AND sm.created_at >= $${paramCount}`;
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters?.endDate) {
    query += ` AND sm.created_at <= $${paramCount}`;
    params.push(filters.endDate);
    paramCount++;
  }

  query += ' ORDER BY sm.created_at DESC LIMIT 500';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get stock adjustments summary statistics
 */
export async function getStockAdjustmentsSummary(): Promise<{
  totalAdjustments: number;
  totalAdjustmentIn: number;
  totalAdjustmentOut: number;
  totalDamage: number;
  totalExpiry: number;
}> {
  const query = `
    SELECT 
      COUNT(*) AS total_adjustments,
      COUNT(*) FILTER (WHERE movement_type = 'ADJUSTMENT_IN') AS total_adjustment_in,
      COUNT(*) FILTER (WHERE movement_type = 'ADJUSTMENT_OUT') AS total_adjustment_out,
      COUNT(*) FILTER (WHERE movement_type = 'DAMAGE') AS total_damage,
      COUNT(*) FILTER (WHERE movement_type = 'EXPIRY') AS total_expiry
    FROM stock_movements
    WHERE movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY', 'RETURN')
  `;

  const result = await pool.query(query);
  const row = result.rows[0];

  return {
    totalAdjustments: parseInt(row.total_adjustments) || 0,
    totalAdjustmentIn: parseInt(row.total_adjustment_in) || 0,
    totalAdjustmentOut: parseInt(row.total_adjustment_out) || 0,
    totalDamage: parseInt(row.total_damage) || 0,
    totalExpiry: parseInt(row.total_expiry) || 0,
  };
}
