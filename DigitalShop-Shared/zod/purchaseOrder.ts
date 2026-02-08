import { z } from 'zod';

/**
 * Purchase Order (PO) schemas for ordering inventory from suppliers
 * Field names match DB columns (snake_case → camelCase):
 *   order_number → orderNumber, ordered_quantity → orderedQuantity, unit_price → unitPrice
 */

// Purchase order status enum - matches DB: purchase_order_status
export const PurchaseOrderStatusEnum = z.enum(['DRAFT', 'SENT', 'PARTIAL', 'RECEIVED', 'CANCELLED']);

export const PurchaseOrderItemSchema = z.object({
  productId: z.string().uuid(),
  orderedQuantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
}).strict();

export const PurchaseOrderSchema = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  supplierId: z.string().uuid(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  status: PurchaseOrderStatusEnum,
  paymentTerms: z.string().max(50).optional(),
  totalAmount: z.number().nonnegative(),
  notes: z.string().max(1000).optional(),
  createdById: z.string().uuid().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).strict();

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid(),
  orderDate: z.string(),
  expectedDeliveryDate: z.string().optional(),
  paymentTerms: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(PurchaseOrderItemSchema).min(1, 'At least one item is required'),
}).strict();

export const UpdatePurchaseOrderSchema = CreatePurchaseOrderSchema.partial();

export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;
export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusEnum>;
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;
export type CreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrder = z.infer<typeof UpdatePurchaseOrderSchema>;
