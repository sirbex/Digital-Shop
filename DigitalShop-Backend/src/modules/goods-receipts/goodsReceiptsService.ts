import { Pool } from 'pg';
import Decimal from 'decimal.js';
import * as GRRepository from './goodsReceiptsRepository.js';
import { logger } from '../../utils/logger.js';

/**
 * Goods Receipts Service
 * Business logic for receiving inventory from suppliers
 */

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  receiptNumber: string; // Alias for grNumber
  purchaseOrderId: string | null;
  poNumber: string | null;
  supplierId: string | null;
  supplierName: string | null;
  receivedDate: string;
  receivedById: string;
  receivedByName: string | null;
  totalAmount: number;
  totalValue: number; // Alias for totalAmount
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GRItem {
  id: string;
  goodsReceiptId: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  purchaseOrderItemId: string | null;
  receivedQuantity: number;
  costPrice: number;
  expiryDate: string | null;
  batchNumber: string | null;
  discrepancyType: string | null;
  totalAmount: number;
  createdAt: string;
}

export interface GoodsReceiptWithItems extends GoodsReceipt {
  items: GRItem[];
}

export interface CreateGRData {
  purchaseOrderId?: string;
  receivedDate: string;
  receivedById: string;
  notes?: string;
  autoComplete?: boolean; // If true, auto-finalize. Default false (stay in DRAFT)
  items: Array<{
    productId: string;
    purchaseOrderItemId?: string;
    receivedQuantity: number;
    costPrice: number;
    expiryDate?: string;
    batchNumber?: string;
    discrepancyType?: string;
  }>;
}

/**
 * Create goods receipt
 */
export async function createGoodsReceipt(data: CreateGRData) {
  if (!data.items || data.items.length === 0) {
    throw new Error('At least one item is required');
  }

  // Validate quantities
  for (const item of data.items) {
    if (item.receivedQuantity < 0) {
      throw new Error('Received quantity must be non-negative');
    }
  }

  // Create GR header
  const gr = await GRRepository.createGoodsReceipt({
    purchaseOrderId: data.purchaseOrderId,
    receivedDate: data.receivedDate,
    receivedById: data.receivedById,
    notes: data.notes,
  });

  // Create GR items
  const items = [];
  for (const item of data.items) {
    const grItem = await GRRepository.createGoodsReceiptItem(gr.id, {
      productId: item.productId,
      purchaseOrderItemId: item.purchaseOrderItemId,
      receivedQuantity: item.receivedQuantity,
      costPrice: item.costPrice,
      expiryDate: item.expiryDate,
      batchNumber: item.batchNumber,
      discrepancyType: item.discrepancyType,
    });
    items.push(grItem);
  }

  // Update total
  await GRRepository.updateGoodsReceiptTotal(gr.id);

  // Only auto-complete if explicitly requested (default: keep in DRAFT for user review)
  if (data.autoComplete) {
    await GRRepository.updateGoodsReceiptStatus(gr.id, 'COMPLETED');
  }

  // Reload with complete data
  const completeGR = await GRRepository.findGoodsReceiptById(gr.id);
  const completeItems = await GRRepository.findGoodsReceiptItems(gr.id);

  logger.info('Goods receipt created', {
    grId: gr.id,
    grNumber: gr.receiptNumber,
    purchaseOrderId: data.purchaseOrderId,
    itemCount: items.length,
  });

  return {
    ...completeGR,
    items: completeItems,
  };
}

/**
 * Get goods receipt by ID
 */
export async function getGoodsReceipt(grId: string): Promise<GoodsReceiptWithItems> {
  const gr = await GRRepository.findGoodsReceiptById(grId);
  if (!gr) {
    throw new Error('Goods receipt not found');
  }

  const items = await GRRepository.findGoodsReceiptItems(grId);

  return {
    id: gr.id,
    grNumber: gr.receiptNumber, // Alias for frontend
    receiptNumber: gr.receiptNumber,
    purchaseOrderId: gr.purchaseOrderId,
    poNumber: gr.poNumber,
    supplierId: gr.supplierId,
    supplierName: gr.supplierName,
    receivedDate: gr.receivedDate,
    receivedById: gr.receivedById,
    receivedByName: gr.receivedByName,
    totalAmount: parseFloat(gr.totalValue || '0'), // Alias for frontend
    totalValue: parseFloat(gr.totalValue || '0'),
    status: gr.status,
    notes: gr.notes,
    createdAt: gr.createdAt,
    updatedAt: gr.updatedAt,
    items: items.map((item: any) => ({
      id: item.id,
      goodsReceiptId: item.goodsReceiptId,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      purchaseOrderItemId: item.purchaseOrderItemId,
      receivedQuantity: parseFloat(item.receivedQuantity || '0'),
      costPrice: parseFloat(item.costPrice || '0'),
      expiryDate: item.expiryDate,
      batchNumber: item.batchNumber,
      discrepancyType: item.discrepancyType,
      totalAmount: parseFloat(item.totalAmount || '0'),
      createdAt: item.createdAt,
    })),
  };
}

/**
 * Get all goods receipts
 */
export async function getAllGoodsReceipts(filters?: {
  supplierId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<GoodsReceipt[]> {
  const rows = await GRRepository.findAllGoodsReceipts(filters);
  return rows.map((row: any) => ({
    id: row.id,
    grNumber: row.grNumber,
    receiptNumber: row.grNumber, // Keep for backward compatibility
    purchaseOrderId: row.purchaseOrderId,
    poNumber: row.poNumber,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    receivedDate: row.receivedDate,
    receivedById: row.receivedById,
    receivedByName: row.receivedByName,
    totalAmount: parseFloat(row.totalAmount || '0'),
    totalValue: parseFloat(row.totalAmount || '0'), // Keep for backward compatibility
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Get goods receipt summary statistics
 */
export async function getGoodsReceiptSummary() {
  const allGRs = await GRRepository.findAllGoodsReceipts();

  const completed = allGRs.filter((gr: any) => gr.status === 'COMPLETED').length;
  const draft = allGRs.filter((gr: any) => gr.status === 'DRAFT').length;
  const totalValue = allGRs
    .filter((gr: any) => gr.status === 'COMPLETED')
    .reduce((sum: number, gr: any) => new Decimal(sum).plus(gr.totalValue || 0).toNumber(), 0);

  return {
    total: allGRs.length,
    completed,
    draft,
    totalValue,
  };
}

// ============================================================================
// SamplePOS-compatible methods (using pool from request)
// ============================================================================

/**
 * List goods receipts with pagination
 */
export async function listGoodsReceipts(
  dbPool: Pool,
  page: number = 1,
  limit: number = 50,
  filters?: {
    status?: string;
    supplierId?: string;
  }
): Promise<{ receipts: GoodsReceipt[]; total: number }> {
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: any[] = [];
  let paramIndex = 1;

  if (filters?.status) {
    whereClause += ` AND gr.status = $${paramIndex}`;
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
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
    WHERE ${whereClause}
  `;
  const countResult = await dbPool.query(countQuery, params);
  const total = countResult.rows[0]?.total || 0;

  // Get paginated results
  const query = `
    SELECT 
      gr.id,
      gr.receipt_number AS "receiptNumber",
      gr.purchase_order_id AS "purchaseOrderId",
      po.order_number AS "poNumber",
      gr.received_date AS "receivedDate",
      gr.received_by_id AS "receivedById",
      u.full_name AS "receivedByName",
      gr.status,
      gr.total_value AS "totalValue",
      gr.notes,
      gr.created_at AS "createdAt",
      gr.updated_at AS "updatedAt",
      po.supplier_id AS "supplierId",
      s.name AS "supplierName"
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
    LEFT JOIN suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u ON gr.received_by_id = u.id
    WHERE ${whereClause}
    ORDER BY gr.received_date DESC, gr.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const result = await dbPool.query(query, [...params, limit, offset]);

  const receipts = result.rows.map((row: any) => ({
    id: row.id,
    grNumber: row.receiptNumber, // Alias for frontend
    receiptNumber: row.receiptNumber,
    purchaseOrderId: row.purchaseOrderId,
    poNumber: row.poNumber,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    receivedDate: row.receivedDate,
    receivedById: row.receivedById,
    receivedByName: row.receivedByName,
    totalAmount: parseFloat(row.totalValue || '0'), // Alias for frontend
    totalValue: parseFloat(row.totalValue || '0'),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return { receipts, total };
}

/**
 * Create goods receipt (V2 - SamplePOS compatible)
 */
export async function createGoodsReceiptV2(
  dbPool: Pool,
  data: {
    purchaseOrderId?: string;
    receivedDate: string;
    notes?: string;
    items: Array<{
      productId: string;
      purchaseOrderItemId?: string;
      receivedQuantity: number;
      costPrice: number;
      expiryDate?: string;
      batchNumber?: string;
    }>;
  },
  userId: string
): Promise<GoodsReceiptWithItems> {
  return await createGoodsReceipt({
    ...data,
    receivedById: userId,
  });
}

/**
 * Get goods receipt detail
 */
export async function getGoodsReceiptDetail(
  dbPool: Pool,
  grId: string
): Promise<GoodsReceiptWithItems> {
  return await getGoodsReceipt(grId);
}

/**
 * Cancel goods receipt
 */
export async function cancelGoodsReceipt(
  dbPool: Pool,
  grId: string,
  userId: string
): Promise<GoodsReceipt> {
  const gr = await GRRepository.findGoodsReceiptById(grId);
  if (!gr) {
    throw new Error('Goods receipt not found');
  }

  if (gr.status === 'COMPLETED') {
    throw new Error('Cannot cancel a completed goods receipt');
  }

  await GRRepository.updateGoodsReceiptStatus(grId, 'CANCELLED');
  
  const updated = await GRRepository.findGoodsReceiptById(grId);
  return {
    id: updated.id,
    grNumber: updated.receiptNumber, // Alias for frontend
    receiptNumber: updated.receiptNumber,
    purchaseOrderId: updated.purchaseOrderId,
    poNumber: updated.poNumber,
    supplierId: updated.supplierId,
    supplierName: updated.supplierName,
    receivedDate: updated.receivedDate,
    receivedById: updated.receivedById,
    receivedByName: updated.receivedByName,
    totalAmount: parseFloat(updated.totalValue || '0'), // Alias for frontend
    totalValue: parseFloat(updated.totalValue || '0'),
    status: updated.status,
    notes: updated.notes,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Update goods receipt item
 */
export async function updateGoodsReceiptItem(
  grId: string,
  itemId: string,
  data: {
    receivedQuantity?: number;
    unitCost?: number;
    batchNumber?: string | null;
    expiryDate?: string | null;
  }
) {
  // Verify the GR exists and is in DRAFT status
  const gr = await GRRepository.findGoodsReceiptById(grId);
  if (!gr) {
    throw new Error('Goods receipt not found');
  }
  
  if (gr.status !== 'DRAFT') {
    throw new Error('Cannot update items on a finalized or cancelled goods receipt');
  }

  // Verify the item belongs to this GR
  const item = await GRRepository.findGoodsReceiptItemById(itemId);
  if (!item || item.goodsReceiptId !== grId) {
    throw new Error('Goods receipt item not found');
  }

  // Update the item
  const updated = await GRRepository.updateGoodsReceiptItem(itemId, data);

  // Update the GR total
  await GRRepository.updateGoodsReceiptTotal(grId);

  return updated;
}

/**
 * Finalize goods receipt - creates inventory batches and updates stock
 */
export async function finalizeGoodsReceipt(grId: string) {
  // Verify the GR exists and is in DRAFT status
  const gr = await GRRepository.findGoodsReceiptById(grId);
  if (!gr) {
    throw new Error('Goods receipt not found');
  }
  
  if (gr.status !== 'DRAFT') {
    throw new Error('Goods receipt is already finalized or cancelled');
  }

  // Check that all items have valid data
  const items = await GRRepository.findGoodsReceiptItems(grId);
  if (items.length === 0) {
    throw new Error('Goods receipt has no items');
  }

  for (const item of items) {
    if (item.receivedQuantity <= 0) {
      throw new Error(`Item ${item.productName} has invalid quantity`);
    }
    if (item.costPrice < 0) {
      throw new Error(`Item ${item.productName} has invalid cost price`);
    }
  }

  // Finalize the GR
  return await GRRepository.finalizeGoodsReceipt(grId);
}
