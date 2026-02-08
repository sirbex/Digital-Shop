import { z } from 'zod';

/**
 * Goods Receipt (GR) schemas for receiving inventory from suppliers
 */

// GR Status enum - matches DB: goods_receipt_status
export const GoodsReceiptStatusEnum = z.enum(['DRAFT', 'COMPLETED', 'CANCELLED']);
export type GoodsReceiptStatus = z.infer<typeof GoodsReceiptStatusEnum>;

// GR Item schema for creating/updating
// DB column: cost_price → costPrice
export const GoodsReceiptItemSchema = z.object({
  id: z.string().uuid().optional(),
  purchaseOrderItemId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid(),
  productName: z.string().optional(),
  orderedQuantity: z.number().nonnegative(),
  receivedQuantity: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  expiryDate: z.string().nullable().optional(), // ISO date string or YYYY-MM-DD
  batchNumber: z.string().max(100).nullable().optional(),
});

// Full GR Item with all fields (for reading)
export const GoodsReceiptItemFullSchema = GoodsReceiptItemSchema.extend({
  id: z.string().uuid(),
  goodsReceiptId: z.string().uuid().optional(),
  uomSymbol: z.string().optional(),
  conversionFactor: z.number().optional(),
  poUnitPrice: z.number().optional(),
  productCostPrice: z.number().optional(),
});

// Main Goods Receipt schema
// DB columns: receipt_number → receiptNumber, received_by_id → receivedById, total_value → totalValue
export const GoodsReceiptSchema = z.object({
  id: z.string().uuid(),
  receiptNumber: z.string(),
  purchaseOrderId: z.string().uuid().optional().nullable(),
  poNumber: z.string().optional().nullable(), // Joined from purchase_orders.order_number
  supplierId: z.string().uuid().optional().nullable(),
  supplierName: z.string().optional().nullable(), // Joined from suppliers.name
  receivedDate: z.string(), // ISO date string or YYYY-MM-DD
  receivedById: z.string().uuid().optional().nullable(),
  receivedByName: z.string().optional().nullable(), // Joined from users.full_name
  status: GoodsReceiptStatusEnum,
  totalValue: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Schema for creating a GR from a PO
// Canonical field names match backend service/repository:
//   received_date → receivedDate, purchase_order_item_id → purchaseOrderItemId, cost_price → costPrice
export const CreateGoodsReceiptFromPOSchema = z.object({
  purchaseOrderId: z.string().uuid().optional().nullable(),
  receivedDate: z.string(), // ISO date string or YYYY-MM-DD
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(z.object({
    purchaseOrderItemId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid(),
    productName: z.string().optional(),
    orderedQuantity: z.number().nonnegative().optional(),
    receivedQuantity: z.number().nonnegative(),
    costPrice: z.number().nonnegative(),
    batchNumber: z.string().max(100).nullable().optional(),
    expiryDate: z.string().nullable().optional(),
  })).min(1, 'At least one item is required'),
});

// Schema for creating a manual GR (no PO)
export const CreateManualGoodsReceiptSchema = z.object({
  supplierId: z.string().uuid(),
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(1000).optional().nullable(),
  supplierDeliveryNote: z.string().max(255).optional().nullable(),
  items: z.array(GoodsReceiptItemSchema).min(1, 'At least one item is required'),
});

// Schema for updating a GR item
// DB column: cost_price → costPrice
export const UpdateGoodsReceiptItemSchema = z.object({
  receivedQuantity: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  batchNumber: z.string().max(100).nullable().optional(),
  expiryDate: z.string().nullable().optional(),
});

// Schema for list query params
export const GoodsReceiptListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: GoodsReceiptStatusEnum.optional(),
  supplierId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// Cost alert schema (returned after finalize)
export const CostAlertSchema = z.object({
  type: z.string(),
  severity: z.enum(['HIGH', 'MEDIUM']),
  productId: z.string().uuid(),
  productName: z.string(),
  message: z.string(),
  details: z.object({
    previousCost: z.string(),
    newCost: z.string(),
    changeAmount: z.string(),
    changePercentage: z.string(),
    batchNumber: z.string().optional(),
  }),
});

// Inferred types
export type GoodsReceipt = z.infer<typeof GoodsReceiptSchema>;
export type GoodsReceiptItem = z.infer<typeof GoodsReceiptItemSchema>;
export type GoodsReceiptItemFull = z.infer<typeof GoodsReceiptItemFullSchema>;
export type CreateGoodsReceiptFromPO = z.infer<typeof CreateGoodsReceiptFromPOSchema>;
export type CreateManualGoodsReceipt = z.infer<typeof CreateManualGoodsReceiptSchema>;
export type UpdateGoodsReceiptItem = z.infer<typeof UpdateGoodsReceiptItemSchema>;
export type GoodsReceiptListQuery = z.infer<typeof GoodsReceiptListQuerySchema>;
export type CostAlert = z.infer<typeof CostAlertSchema>;
