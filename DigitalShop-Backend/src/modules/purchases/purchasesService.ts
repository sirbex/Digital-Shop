import { Pool } from 'pg';
import Decimal from 'decimal.js';
import { logger } from '../../utils/logger.js';
import * as purchasesRepository from './purchasesRepository.js';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string | null;
  orderDate: string;
  expectedDeliveryDate: string | null;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  paymentTerms: string | null;
  totalAmount: number;
  notes: string | null;
  createdById: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface POItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: POItem[];
}

export interface CreatePOData {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  notes?: string;
  items: {
    productId: string;
    orderedQuantity: number;
    unitPrice: number;
    notes?: string;
  }[];
}

/**
 * Convert database row to PurchaseOrder object
 */
function toPO(row: purchasesRepository.PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    status: row.status as PurchaseOrder['status'],
    paymentTerms: row.payment_terms,
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert database row to POItem object
 */
function toPOItem(row: purchasesRepository.POItemRow): POItem {
  return {
    id: row.id,
    purchaseOrderId: row.purchase_order_id,
    productId: row.product_id,
    productName: row.product_name,
    sku: row.sku,
    orderedQuantity: parseFloat(row.ordered_quantity),
    receivedQuantity: parseFloat(row.received_quantity),
    unitPrice: parseFloat(row.unit_price),
    totalPrice: parseFloat(row.total_price),
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Calculate PO totals
 */
function calculatePOTotals(items: CreatePOData['items']) {
  let total = new Decimal(0);

  items.forEach(item => {
    const lineTotal = new Decimal(item.orderedQuantity).times(item.unitPrice);
    total = total.plus(lineTotal);
  });

  return total.toNumber();
}

/**
 * Get all purchase orders
 */
export async function getAllPurchaseOrders(
  pool: Pool,
  filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<PurchaseOrder[]> {
  const rows = await purchasesRepository.getAllPurchaseOrders(pool, filters);
  return rows.map(toPO);
}

/**
 * Get purchase order by ID with items
 */
export async function getPurchaseOrderById(pool: Pool, id: string): Promise<PurchaseOrderWithItems> {
  const poRow = await purchasesRepository.getPurchaseOrderById(pool, id);

  if (!poRow) {
    throw new Error('Purchase order not found');
  }

  const itemRows = await purchasesRepository.getPOItems(pool, id);

  return {
    ...toPO(poRow),
    items: itemRows.map(toPOItem),
  };
}

/**
 * Create purchase order
 */
export async function createPurchaseOrder(
  pool: Pool,
  data: CreatePOData,
  userId: string
): Promise<string> {
  if (!data.items || data.items.length === 0) {
    throw new Error('Purchase order must have at least one item');
  }

  const totalAmount = calculatePOTotals(data.items);

  const poData: purchasesRepository.CreatePOParams = {
    supplierId: data.supplierId,
    orderDate: data.orderDate,
    expectedDeliveryDate: data.expectedDeliveryDate,
    paymentTerms: data.paymentTerms,
    totalAmount: totalAmount,
    notes: data.notes,
    createdById: userId,
  };

  const poItems = data.items.map(item => ({
    productId: item.productId,
    orderedQuantity: item.orderedQuantity,
    unitPrice: item.unitPrice,
    notes: item.notes,
  }));

  const poId = await purchasesRepository.createPurchaseOrder(pool, poData, poItems);

  return poId;
}

/**
 * Update PO status
 */
export async function updatePurchaseOrderStatus(
  pool: Pool,
  poId: string,
  status: string
): Promise<void> {
  await purchasesRepository.updatePOStatus(pool, poId, status);
}

/**
 * Get pending PO items (items not fully received)
 */
export async function getPendingPOItems(pool: Pool, poId: string): Promise<POItem[]> {
  const rows = await purchasesRepository.getPendingPOItems(pool, poId);
  return rows.map(toPOItem);
}

/**
 * Check if all PO items are fully received
 */
export async function isPOFullyReceived(pool: Pool, poId: string): Promise<boolean> {
  return await purchasesRepository.isPOFullyReceived(pool, poId);
}

// ============================================================================
// SamplePOS-compatible methods (using pool from request)
// ============================================================================

/**
 * List purchase orders with pagination
 */
export async function listPurchaseOrders(
  dbPool: Pool,
  page: number = 1,
  limit: number = 50,
  filters?: {
    status?: string;
    supplierId?: string;
  }
): Promise<{ orders: PurchaseOrder[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    whereClause += ` AND po.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.supplierId) {
    whereClause += ` AND po.supplier_id = $${paramIndex}`;
    params.push(filters.supplierId);
    paramIndex++;
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*)::int as total
    FROM purchase_orders po
    WHERE ${whereClause}
  `;
  const countResult = await dbPool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Get paginated results
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
      po.created_at,
      po.updated_at
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON po.created_by_id = u.id
    WHERE ${whereClause}
    ORDER BY po.order_date DESC, po.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await dbPool.query(query, [...params, limit, offset]);

  const orders = result.rows.map((row: any) => ({
    id: row.id,
    orderNumber: row.order_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    status: row.status,
    paymentTerms: row.payment_terms,
    totalAmount: parseFloat(row.total_amount || '0'),
    notes: row.notes,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { orders, total };
}

/**
 * Create purchase order (V2 - SamplePOS compatible)
 */
export async function createPurchaseOrderV2(
  dbPool: Pool,
  data: {
    supplierId: string;
    orderDate: string;
    expectedDeliveryDate?: string;
    paymentTerms?: string;
    notes?: string;
    items: Array<{
      productId: string;
      orderedQuantity: number;
      unitPrice: number;
      notes?: string;
    }>;
  },
  userId: string
): Promise<PurchaseOrderWithItems> {
  const poId = await createPurchaseOrder(dbPool, data, userId);
  return await getPurchaseOrderById(dbPool, poId);
}

/**
 * Get purchase order detail (V2 - SamplePOS compatible)
 */
export async function getPurchaseOrderDetail(
  dbPool: Pool,
  poId: string
): Promise<PurchaseOrderWithItems> {
  return await getPurchaseOrderById(dbPool, poId);
}

/**
 * Update PO status (V2 - SamplePOS compatible)
 */
export async function updatePOStatusV2(
  dbPool: Pool,
  poId: string,
  status: string,
  userId: string
): Promise<PurchaseOrder> {
  await purchasesRepository.updatePOStatus(dbPool, poId, status);
  const po = await purchasesRepository.getPurchaseOrderById(dbPool, poId);
  if (!po) {
    throw new Error('Purchase order not found');
  }
  return toPO(po);
}
