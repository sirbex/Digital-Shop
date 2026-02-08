import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface StockMovement {
  id: string;
  movementNumber: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  batchId: string | null;
  batchNumber: string | null;
  movementType: string;
  quantity: number;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
}

function toStockMovement(row: any): StockMovement {
  return {
    id: row.id,
    movementNumber: row.movement_number,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    movementType: row.movement_type,
    quantity: parseFloat(row.quantity || 0),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceNumber: row.reference_number,
    notes: row.notes,
    createdBy: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  };
}

/**
 * List stock movements with pagination and filters
 */
export async function listStockMovements(
  pool: Pool,
  page: number = 1,
  limit: number = 50,
  filters?: {
    productId?: string;
    batchId?: string;
    movementType?: string;
    referenceType?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ movements: StockMovement[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.productId) {
    whereClause += ` AND sm.product_id = $${paramIndex}`;
    params.push(filters.productId);
    paramIndex++;
  }

  if (filters?.batchId) {
    whereClause += ` AND sm.batch_id = $${paramIndex}`;
    params.push(filters.batchId);
    paramIndex++;
  }

  if (filters?.movementType) {
    // Map legacy group aliases to real DB movement_type enum values
    const MOVEMENT_TYPE_GROUPS: Record<string, string[]> = {
      'IN': ['GOODS_RECEIPT', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN'],
      'OUT': ['SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT', 'DAMAGE', 'EXPIRY'],
      'ADJUSTMENT': ['ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY'],
    };

    const groupValues = MOVEMENT_TYPE_GROUPS[filters.movementType];
    if (groupValues) {
      // Legacy alias: expand to multiple DB values using ANY($n)
      whereClause += ` AND sm.movement_type = ANY($${paramIndex})`;
      params.push(groupValues);
      paramIndex++;
    } else {
      // Exact DB enum value (e.g., 'GOODS_RECEIPT', 'SALE', etc.)
      whereClause += ` AND sm.movement_type = $${paramIndex}`;
      params.push(filters.movementType);
      paramIndex++;
    }
  }

  if (filters?.referenceType) {
    whereClause += ` AND sm.reference_type = $${paramIndex}`;
    params.push(filters.referenceType);
    paramIndex++;
  }

  if (filters?.startDate) {
    whereClause += ` AND sm.created_at >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters?.endDate) {
    whereClause += ` AND sm.created_at <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM stock_movements sm
    WHERE ${whereClause}
  `;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Get paginated results with reference numbers
  const query = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.sku,
      ib.batch_number,
      u.full_name as created_by_name,
      CASE 
        WHEN sm.reference_type = 'SALE' THEN s.sale_number
        WHEN sm.reference_type = 'GOODS_RECEIPT' THEN gr.receipt_number
        ELSE NULL
      END as reference_number
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN inventory_batches ib ON sm.batch_id = ib.id
    LEFT JOIN users u ON sm.created_by_id = u.id
    LEFT JOIN sales s ON sm.reference_type = 'SALE' AND sm.reference_id = s.id
    LEFT JOIN goods_receipts gr ON sm.reference_type = 'GOODS_RECEIPT' AND sm.reference_id = gr.id
    WHERE ${whereClause}
    ORDER BY sm.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  const movements = result.rows.map(toStockMovement);

  return { movements, total };
}

/**
 * Get stock movement by ID
 */
export async function getStockMovementById(pool: Pool, id: string): Promise<StockMovement> {
  const query = `
    SELECT 
      sm.*,
      p.name as product_name,
      p.sku,
      ib.batch_number,
      u.full_name as created_by_name,
      CASE 
        WHEN sm.reference_type = 'SALE' THEN s.sale_number
        WHEN sm.reference_type = 'GOODS_RECEIPT' THEN gr.receipt_number
        ELSE NULL
      END as reference_number
    FROM stock_movements sm
    LEFT JOIN products p ON sm.product_id = p.id
    LEFT JOIN inventory_batches ib ON sm.batch_id = ib.id
    LEFT JOIN users u ON sm.created_by_id = u.id
    LEFT JOIN sales s ON sm.reference_type = 'SALE' AND sm.reference_id = s.id
    LEFT JOIN goods_receipts gr ON sm.reference_type = 'GOODS_RECEIPT' AND sm.reference_id = gr.id
    WHERE sm.id = $1
  `;

  const result = await pool.query(query, [id]);

  if (result.rows.length === 0) {
    throw new Error('Stock movement not found');
  }

  return toStockMovement(result.rows[0]);
}

/**
 * Get stock movements for a specific product
 */
export async function getProductMovements(
  pool: Pool,
  productId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ movements: StockMovement[]; total: number }> {
  return listStockMovements(pool, page, limit, { productId });
}

/**
 * Get stock movements for a specific batch
 */
export async function getBatchMovements(
  pool: Pool,
  batchId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ movements: StockMovement[]; total: number }> {
  return listStockMovements(pool, page, limit, { batchId });
}

/**
 * Get movements summary
 */
export async function getMovementsSummary(pool: Pool): Promise<{
  totalMovements: number;
  inMovements: number;
  outMovements: number;
  adjustmentMovements: number;
  today: {
    in: number;
    out: number;
    adjustment: number;
  };
}> {
  const query = `
    SELECT
      COUNT(*)::int as total_movements,
      COUNT(*) FILTER (WHERE movement_type IN ('GOODS_RECEIPT', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN'))::int as in_movements,
      COUNT(*) FILTER (WHERE movement_type IN ('SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'))::int as out_movements,
      COUNT(*) FILTER (WHERE movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY'))::int as adjustment_movements,
      COUNT(*) FILTER (WHERE movement_type IN ('GOODS_RECEIPT', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN') AND DATE(created_at) = CURRENT_DATE)::int as today_in,
      COUNT(*) FILTER (WHERE movement_type IN ('SALE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT') AND DATE(created_at) = CURRENT_DATE)::int as today_out,
      COUNT(*) FILTER (WHERE movement_type IN ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'DAMAGE', 'EXPIRY') AND DATE(created_at) = CURRENT_DATE)::int as today_adjustment
    FROM stock_movements
  `;

  const result = await pool.query(query);
  const row = result.rows[0];

  return {
    totalMovements: row.total_movements,
    inMovements: row.in_movements,
    outMovements: row.out_movements,
    adjustmentMovements: row.adjustment_movements,
    today: {
      in: row.today_in,
      out: row.today_out,
      adjustment: row.today_adjustment,
    },
  };
}

/**
 * Create a stock movement record
 */
export async function createStockMovement(
  pool: Pool,
  data: {
    productId: string;
    batchId?: string | null;
    movementType: string;
    quantity: number;
    unitCost?: number | null;
    referenceType?: string | null;
    referenceId?: string | null;
    notes?: string | null;
    createdById: string;
  }
): Promise<StockMovement> {
  // Generate movement number
  const numResult = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(movement_number FROM 4) AS INTEGER)), 0) + 1 as next_num
     FROM stock_movements
     WHERE movement_number LIKE 'SM-%'`
  );
  const nextNum = numResult.rows[0]?.next_num || 1;
  const movementNumber = `SM-${String(nextNum).padStart(8, '0')}`;

  const insertQuery = `
    INSERT INTO stock_movements (
      movement_number, product_id, batch_id, movement_type,
      quantity, unit_cost, reference_type, reference_id, notes, created_by_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
  `;

  const result = await pool.query(insertQuery, [
    movementNumber,
    data.productId,
    data.batchId || null,
    data.movementType,
    data.quantity,
    data.unitCost || null,
    data.referenceType || null,
    data.referenceId || null,
    data.notes || null,
    data.createdById,
  ]);

  logger.info('Stock movement created', {
    movementNumber,
    productId: data.productId,
    movementType: data.movementType,
    quantity: data.quantity,
  });

  return getStockMovementById(pool, result.rows[0].id);
}
