import pool from '../../db/pool.js';
import { logger } from '../../utils/logger.js';

/**
 * Goods Receipts Repository
 * Handles database operations for receiving inventory from suppliers
 * 
 * Database schema:
 * 
 * goods_receipts: id, receipt_number, purchase_order_id, received_date, 
 *                 received_by_id, status, total_value, notes, created_at, updated_at
 * 
 * goods_receipt_items: id, goods_receipt_id, product_id, purchase_order_item_id,
 *                      received_quantity, expiry_date, cost_price, batch_number, 
 *                      discrepancy_type, created_at
 */

export async function createGoodsReceipt(data: {
  purchaseOrderId?: string;
  receivedDate: string;
  receivedById: string;
  notes?: string;
}) {
  // Generate receipt number
  const receiptNumber = await generateGRNumber();

  const query = `
    INSERT INTO goods_receipts (
      receipt_number, purchase_order_id, received_date, received_by_id, notes, status
    )
    VALUES ($1, $2, $3, $4, $5, 'DRAFT')
    RETURNING 
      id,
      receipt_number AS "receiptNumber",
      purchase_order_id AS "purchaseOrderId",
      received_date AS "receivedDate",
      received_by_id AS "receivedById",
      status,
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  const result = await pool.query(query, [
    receiptNumber,
    data.purchaseOrderId || null,
    data.receivedDate,
    data.receivedById,
    data.notes || null,
  ]);

  return result.rows[0];
}

export async function createGoodsReceiptItem(grId: string, item: {
  productId: string;
  purchaseOrderItemId?: string;
  receivedQuantity: number;
  costPrice: number;
  expiryDate?: string;
  batchNumber?: string;
  discrepancyType?: string;
}) {
  const query = `
    INSERT INTO goods_receipt_items (
      goods_receipt_id, product_id, purchase_order_item_id, received_quantity, 
      cost_price, expiry_date, batch_number, discrepancy_type
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING 
      id,
      goods_receipt_id AS "goodsReceiptId",
      product_id AS "productId",
      purchase_order_item_id AS "purchaseOrderItemId",
      received_quantity AS "receivedQuantity",
      cost_price AS "costPrice",
      expiry_date AS "expiryDate",
      batch_number AS "batchNumber",
      discrepancy_type AS "discrepancyType",
      created_at AS "createdAt"
  `;

  const result = await pool.query(query, [
    grId,
    item.productId,
    item.purchaseOrderItemId || null,
    item.receivedQuantity,
    item.costPrice,
    item.expiryDate || null,
    item.batchNumber || null,
    item.discrepancyType || null,
  ]);

  return result.rows[0];
}

export async function updateGoodsReceiptStatus(grId: string, status: 'DRAFT' | 'COMPLETED' | 'CANCELLED') {
  const query = `
    UPDATE goods_receipts
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING 
      id,
      receipt_number AS "receiptNumber",
      status,
      updated_at AS "updatedAt"
  `;

  const result = await pool.query(query, [status, grId]);
  return result.rows[0];
}

export async function updateGoodsReceiptTotal(grId: string) {
  const query = `
    UPDATE goods_receipts
    SET total_value = (
      SELECT COALESCE(SUM(received_quantity * cost_price), 0)
      FROM goods_receipt_items
      WHERE goods_receipt_id = $1
    ),
    updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING 
      id,
      total_value AS "totalValue"
  `;

  const result = await pool.query(query, [grId]);
  return result.rows[0];
}

export async function findGoodsReceiptById(grId: string) {
  const query = `
    SELECT 
      gr.id,
      gr.receipt_number AS "grNumber",
      gr.purchase_order_id AS "purchaseOrderId",
      po.order_number AS "poNumber",
      gr.received_date AS "receivedDate",
      gr.received_by_id AS "receivedById",
      u.full_name AS "receivedByName",
      gr.status,
      gr.total_value AS "totalAmount",
      gr.notes,
      gr.created_at AS "createdAt",
      gr.updated_at AS "updatedAt",
      po.supplier_id AS "supplierId",
      s.name AS "supplierName"
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON gr.received_by_id = u.id
    WHERE gr.id = $1
  `;

  const result = await pool.query(query, [grId]);
  return result.rows[0];
}

export async function findGoodsReceiptItems(grId: string) {
  const query = `
    SELECT 
      gri.id,
      gri.goods_receipt_id AS "goodsReceiptId",
      gri.product_id AS "productId",
      p.name AS "productName",
      p.sku,
      gri.purchase_order_item_id AS "purchaseOrderItemId",
      gri.received_quantity AS "receivedQuantity",
      gri.cost_price AS "costPrice",
      gri.expiry_date AS "expiryDate",
      gri.batch_number AS "batchNumber",
      gri.discrepancy_type AS "discrepancyType",
      gri.created_at AS "createdAt",
      (gri.received_quantity * gri.cost_price) AS "totalAmount"
    FROM goods_receipt_items gri
    JOIN products p ON gri.product_id = p.id
    WHERE gri.goods_receipt_id = $1
    ORDER BY gri.created_at
  `;

  const result = await pool.query(query, [grId]);
  return result.rows;
}

export async function findAllGoodsReceipts(filters?: {
  supplierId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = `
    SELECT 
      gr.id,
      gr.receipt_number AS "grNumber",
      gr.purchase_order_id AS "purchaseOrderId",
      po.order_number AS "poNumber",
      gr.received_date AS "receivedDate",
      gr.received_by_id AS "receivedById",
      u.full_name AS "receivedByName",
      gr.status,
      gr.total_value AS "totalAmount",
      gr.notes,
      gr.created_at AS "createdAt",
      gr.updated_at AS "updatedAt",
      po.supplier_id AS "supplierId",
      s.name AS "supplierName"
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON gr.received_by_id = u.id
    WHERE 1=1
  `;

  const params: any[] = [];
  let paramCount = 1;

  if (filters?.supplierId) {
    query += ` AND po.supplier_id = $${paramCount}`;
    params.push(filters.supplierId);
    paramCount++;
  }

  if (filters?.status) {
    query += ` AND gr.status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  if (filters?.startDate) {
    query += ` AND gr.received_date >= $${paramCount}`;
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters?.endDate) {
    query += ` AND gr.received_date <= $${paramCount}`;
    params.push(filters.endDate);
    paramCount++;
  }

  query += ' ORDER BY gr.received_date DESC, gr.created_at DESC LIMIT 100';

  const result = await pool.query(query, params);
  return result.rows;
}

export async function generateGRNumber(): Promise<string> {
  const query = `
    SELECT 
      receipt_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM goods_receipts 
    WHERE receipt_number LIKE 'GR-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY receipt_number DESC 
    LIMIT 1
  `;

  const result = await pool.query(query);

  if (result.rows.length === 0) {
    const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
    const year = yearResult.rows[0].year;
    return `GR-${year}-0001`;
  }

  const lastGRNumber = result.rows[0].receipt_number;
  const year = result.rows[0].current_year;
  const sequence = parseInt(lastGRNumber.split('-')[2]) + 1;
  return `GR-${year}-${sequence.toString().padStart(4, '0')}`;
}

/**
 * Get goods receipts for a specific purchase order
 */
export async function findGoodsReceiptsByPOId(poId: string) {
  const query = `
    SELECT 
      gr.id,
      gr.receipt_number AS "receiptNumber",
      gr.purchase_order_id AS "purchaseOrderId",
      gr.received_date AS "receivedDate",
      gr.received_by_id AS "receivedById",
      u.full_name AS "receivedByName",
      gr.status,
      gr.total_value AS "totalValue",
      gr.notes,
      gr.created_at AS "createdAt"
    FROM goods_receipts gr
    LEFT JOIN users u ON gr.received_by_id = u.id
    WHERE gr.purchase_order_id = $1
    ORDER BY gr.received_date DESC
  `;

  const result = await pool.query(query, [poId]);
  return result.rows;
}

/**
 * Update a goods receipt item
 */
export async function updateGoodsReceiptItem(
  itemId: string,
  data: {
    receivedQuantity?: number;
    unitCost?: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
  }
) {
  const updates: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  if (data.receivedQuantity !== undefined) {
    updates.push(`received_quantity = $${paramCount}`);
    params.push(data.receivedQuantity);
    paramCount++;
  }

  if (data.unitCost !== undefined) {
    updates.push(`cost_price = $${paramCount}`);
    params.push(data.unitCost);
    paramCount++;
  }

  if (data.batchNumber !== undefined) {
    updates.push(`batch_number = $${paramCount}`);
    params.push(data.batchNumber);
    paramCount++;
  }

  if (data.expiryDate !== undefined) {
    updates.push(`expiry_date = $${paramCount}`);
    params.push(data.expiryDate);
    paramCount++;
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  params.push(itemId);

  const query = `
    UPDATE goods_receipt_items
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING 
      id,
      goods_receipt_id AS "goodsReceiptId",
      product_id AS "productId",
      purchase_order_item_id AS "purchaseOrderItemId",
      received_quantity AS "receivedQuantity",
      cost_price AS "costPrice",
      expiry_date AS "expiryDate",
      batch_number AS "batchNumber",
      discrepancy_type AS "discrepancyType",
      created_at AS "createdAt"
  `;

  const result = await pool.query(query, params);
  return result.rows[0];
}

/**
 * Finalize a goods receipt and create inventory batches
 */
export async function finalizeGoodsReceipt(grId: string) {
  // First update status to COMPLETED and get the purchase_order_id
  const statusResult = await pool.query(`
    UPDATE goods_receipts
    SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND status = 'DRAFT'
    RETURNING id, receipt_number AS "receiptNumber", purchase_order_id AS "purchaseOrderId"
  `, [grId]);

  if (statusResult.rows.length === 0) {
    throw new Error('Goods receipt not found or already finalized');
  }

  const purchaseOrderId = statusResult.rows[0].purchaseOrderId;

  // Get all items from this GR (including purchase_order_item_id)
  const itemsResult = await pool.query(`
    SELECT 
      gri.id,
      gri.product_id AS "productId",
      gri.received_quantity AS "receivedQuantity",
      gri.cost_price AS "costPrice",
      gri.expiry_date AS "expiryDate",
      gri.batch_number AS "batchNumber",
      gri.purchase_order_item_id AS "purchaseOrderItemId",
      p.name AS "productName",
      p.cost_price AS "currentCostPrice"
    FROM goods_receipt_items gri
    JOIN products p ON gri.product_id = p.id
    WHERE gri.goods_receipt_id = $1
  `, [grId]);

  const costAlerts: any[] = [];
  const items = itemsResult.rows;

  // Create inventory batches and update product cost prices
  for (const item of items) {
    // Generate batch number if not provided
    const batchNumber = item.batchNumber || `BATCH-${Date.now()}-${item.productId.slice(0, 8)}`;

    // Create inventory batch
    await pool.query(`
      INSERT INTO inventory_batches (
        product_id, batch_number, quantity, remaining_quantity, 
        cost_price, expiry_date, received_date
      )
      VALUES ($1, $2, $3, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (product_id, batch_number) 
      DO UPDATE SET 
        quantity = inventory_batches.quantity + EXCLUDED.quantity,
        remaining_quantity = inventory_batches.remaining_quantity + EXCLUDED.remaining_quantity
    `, [item.productId, batchNumber, item.receivedQuantity, item.costPrice, item.expiryDate]);

    // NOTE: Trigger trg_sync_inventory_quantity automatically updates products.quantity_on_hand
    // from inventory_batches - no need to manually update here

    // Check if cost price changed and track it
    const oldCost = parseFloat(item.currentCostPrice || 0);
    const newCost = parseFloat(item.costPrice || 0);
    
    if (Math.abs(oldCost - newCost) > 0.01) {
      costAlerts.push({
        productId: item.productId,
        productName: item.productName,
        oldCostPrice: oldCost,
        newCostPrice: newCost,
        changePercent: oldCost > 0 ? ((newCost - oldCost) / oldCost) * 100 : 100,
      });

      // Update product cost price
      await pool.query(`
        UPDATE products 
        SET cost_price = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newCost, item.productId]);
    }

    // Update purchase order item received_quantity if linked
    if (item.purchaseOrderItemId) {
      await pool.query(`
        UPDATE purchase_order_items 
        SET received_quantity = received_quantity + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [item.receivedQuantity, item.purchaseOrderItemId]);
    }
  }

  // Update Purchase Order status if this GR is linked to a PO
  if (purchaseOrderId) {
    // Check if all items in the PO are fully received
    const poStatusCheck = await pool.query(`
      SELECT 
        COUNT(*) AS total_items,
        SUM(CASE WHEN received_quantity >= ordered_quantity THEN 1 ELSE 0 END) AS fully_received_items,
        SUM(CASE WHEN received_quantity > 0 THEN 1 ELSE 0 END) AS partially_received_items
      FROM purchase_order_items 
      WHERE purchase_order_id = $1
    `, [purchaseOrderId]);

    const { total_items, fully_received_items, partially_received_items } = poStatusCheck.rows[0];
    
    let newPoStatus = 'SENT'; // Default: keep PO in SENT state (valid enum value)
    if (parseInt(fully_received_items) >= parseInt(total_items)) {
      newPoStatus = 'RECEIVED'; // All items fully received
    } else if (parseInt(partially_received_items) > 0) {
      newPoStatus = 'PARTIAL'; // Some items received
    }

    await pool.query(`
      UPDATE purchase_orders 
      SET status = $1::purchase_order_status,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newPoStatus, purchaseOrderId]);
  }

  return {
    gr: statusResult.rows[0],
    costAlerts,
  };
}

/**
 * Get a goods receipt item by ID
 */
export async function findGoodsReceiptItemById(itemId: string) {
  const query = `
    SELECT 
      gri.id,
      gri.goods_receipt_id AS "goodsReceiptId",
      gri.product_id AS "productId",
      p.name AS "productName",
      gri.received_quantity AS "receivedQuantity",
      gri.cost_price AS "costPrice",
      gri.expiry_date AS "expiryDate",
      gri.batch_number AS "batchNumber"
    FROM goods_receipt_items gri
    JOIN products p ON gri.product_id = p.id
    WHERE gri.id = $1
  `;

  const result = await pool.query(query, [itemId]);
  return result.rows[0];
}
