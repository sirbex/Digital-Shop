import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger.js';

/**
 * Database row types matching actual schema
 * 
 * purchase_orders: id, order_number, supplier_id, order_date, expected_delivery_date, 
 *                  status, payment_terms, total_amount, notes, created_by_id, sent_date, created_at, updated_at
 * 
 * purchase_order_items: id, purchase_order_id, product_id, ordered_quantity, 
 *                       received_quantity, unit_price, total_price, notes, created_at, updated_at
 */

export interface PurchaseOrderRow {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  payment_terms: string | null;
  total_amount: string;
  notes: string | null;
  created_by_id: string;
  created_by_name: string | null;
  sent_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface POItemRow {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name: string | null;
  sku: string | null;
  ordered_quantity: string;
  received_quantity: string;
  unit_price: string;
  total_price: string;
  notes: string | null;
  created_at: string;
}

export interface CreatePOParams {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  totalAmount: number;
  notes?: string;
  createdById: string;
}

export interface CreatePOItemParams {
  purchaseOrderId: string;
  productId: string;
  orderedQuantity: number;
  unitPrice: number;
  notes?: string;
}

/**
 * Get all purchase orders with filters
 */
export async function getAllPurchaseOrders(
  pool: Pool,
  filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<PurchaseOrderRow[]> {
  let query = `
    SELECT 
      po.id,
      po.order_number,
      po.supplier_id,
      s.name as supplier_name,
      po.order_date,
      po.expected_delivery_date,
      po.status,
      po.payment_terms,
      po.total_amount,
      po.notes,
      po.created_by_id,
      u.full_name as created_by_name,
      po.sent_date,
      po.created_at,
      po.updated_at
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by_id = u.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.supplierId) {
    query += ` AND po.supplier_id = $${paramIndex++}`;
    values.push(filters.supplierId);
  }

  if (filters?.status) {
    query += ` AND po.status = $${paramIndex++}`;
    values.push(filters.status);
  }

  if (filters?.startDate) {
    query += ` AND po.order_date >= $${paramIndex++}`;
    values.push(filters.startDate);
  }

  if (filters?.endDate) {
    query += ` AND po.order_date <= $${paramIndex++}`;
    values.push(filters.endDate);
  }

  query += ' ORDER BY po.order_date DESC, po.created_at DESC';

  try {
    const result = await pool.query<PurchaseOrderRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all purchase orders', { filters, error });
    throw error;
  }
}

/**
 * Get purchase order by ID
 */
export async function getPurchaseOrderById(pool: Pool, id: string): Promise<PurchaseOrderRow | null> {
  const query = `
    SELECT 
      po.id,
      po.order_number,
      po.supplier_id,
      s.name as supplier_name,
      po.order_date,
      po.expected_delivery_date,
      po.status,
      po.payment_terms,
      po.total_amount,
      po.notes,
      po.created_by_id,
      u.full_name as created_by_name,
      po.sent_date,
      po.created_at,
      po.updated_at
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by_id = u.id
    WHERE po.id = $1
  `;

  try {
    const result = await pool.query<PurchaseOrderRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get purchase order by ID', { id, error });
    throw error;
  }
}

/**
 * Get PO items
 */
export async function getPOItems(pool: Pool, poId: string): Promise<POItemRow[]> {
  const query = `
    SELECT 
      poi.id,
      poi.purchase_order_id,
      poi.product_id,
      p.name as product_name,
      p.sku,
      poi.ordered_quantity,
      poi.received_quantity,
      poi.unit_price,
      poi.total_price,
      poi.notes,
      poi.created_at
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = $1
    ORDER BY poi.created_at
  `;

  try {
    const result = await pool.query<POItemRow>(query, [poId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get PO items', { poId, error });
    throw error;
  }
}

/**
 * Generate next PO number
 */
export async function generatePONumber(pool: Pool): Promise<string> {
  const query = `
    SELECT 
      order_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM purchase_orders 
    WHERE order_number LIKE 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY order_number DESC 
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    
    let year: number;
    if (result.rows.length === 0) {
      const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
      year = yearResult.rows[0].year;
      return `PO-${year}-0001`;
    }

    year = result.rows[0].current_year;
    const lastNumber = result.rows[0].order_number;
    const lastSequence = parseInt(lastNumber.split('-')[2]);
    const nextSequence = (lastSequence + 1).toString().padStart(4, '0');

    return `PO-${year}-${nextSequence}`;
  } catch (error) {
    logger.error('Failed to generate PO number', { error });
    throw error;
  }
}

/**
 * Create purchase order with transaction
 */
export async function createPurchaseOrder(
  pool: Pool,
  poData: CreatePOParams,
  items: Omit<CreatePOItemParams, 'purchaseOrderId'>[]
): Promise<string> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate PO number
    const orderNumber = await generatePONumber(pool);

    // Create PO header
    const poQuery = `
      INSERT INTO purchase_orders (
        order_number, supplier_id, order_date, expected_delivery_date,
        payment_terms, total_amount, status, notes, created_by_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8)
      RETURNING id
    `;

    const poResult = await client.query(poQuery, [
      orderNumber,
      poData.supplierId,
      poData.orderDate,
      poData.expectedDeliveryDate || null,
      poData.paymentTerms || null,
      poData.totalAmount,
      poData.notes || null,
      poData.createdById,
    ]);

    const poId = poResult.rows[0].id;

    // Create PO items
    for (const item of items) {
      const totalPrice = item.orderedQuantity * item.unitPrice;

      const itemQuery = `
        INSERT INTO purchase_order_items (
          purchase_order_id, product_id, ordered_quantity, received_quantity,
          unit_price, total_price, notes
        )
        VALUES ($1, $2, $3, 0, $4, $5, $6)
      `;

      await client.query(itemQuery, [
        poId,
        item.productId,
        item.orderedQuantity,
        item.unitPrice,
        totalPrice,
        item.notes || null,
      ]);
    }

    await client.query('COMMIT');
    logger.info('Purchase order created', { poId, orderNumber, totalAmount: poData.totalAmount });

    return poId;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to create purchase order', { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update PO status
 */
export async function updatePOStatus(pool: Pool, poId: string, status: string): Promise<void> {
  const query = `
    UPDATE purchase_orders
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  try {
    const result = await pool.query(query, [status, poId]);

    if (result.rowCount === 0) {
      throw new Error('Purchase order not found');
    }

    logger.info('PO status updated', { poId, status });
  } catch (error) {
    logger.error('Failed to update PO status', { poId, status, error });
    throw error;
  }
}

/**
 * Update received quantity for a PO item
 */
export async function updatePOItemReceivedQuantity(
  client: PoolClient,
  itemId: string,
  receivedQuantity: number
): Promise<void> {
  const query = `
    UPDATE purchase_order_items
    SET received_quantity = received_quantity + $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;

  await client.query(query, [receivedQuantity, itemId]);
}

/**
 * Get PO items by purchase order ID (for goods receipt)
 */
export async function getPendingPOItems(pool: Pool, poId: string): Promise<POItemRow[]> {
  const query = `
    SELECT 
      poi.id,
      poi.purchase_order_id,
      poi.product_id,
      p.name as product_name,
      p.sku,
      poi.ordered_quantity,
      poi.received_quantity,
      poi.unit_price,
      poi.total_price,
      poi.notes,
      poi.created_at
    FROM purchase_order_items poi
    JOIN products p ON poi.product_id = p.id
    WHERE poi.purchase_order_id = $1
      AND poi.ordered_quantity > poi.received_quantity
    ORDER BY poi.created_at
  `;

  try {
    const result = await pool.query<POItemRow>(query, [poId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get pending PO items', { poId, error });
    throw error;
  }
}

/**
 * Check if all PO items are fully received
 */
export async function isPOFullyReceived(pool: Pool, poId: string): Promise<boolean> {
  const query = `
    SELECT COUNT(*) as pending
    FROM purchase_order_items
    WHERE purchase_order_id = $1
      AND ordered_quantity > received_quantity
  `;

  const result = await pool.query(query, [poId]);
  return parseInt(result.rows[0].pending) === 0;
}

