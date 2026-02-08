import { z } from 'zod';

// Refund Type Enum
export const RefundType = z.enum(['FULL', 'PARTIAL']);

// Refund Reason Enum
export const RefundReason = z.enum([
  'CUSTOMER_REQUEST',
  'DAMAGED_PRODUCT',
  'WRONG_PRODUCT',
  'QUALITY_ISSUE',
  'PRICING_ERROR',
  'OTHER'
]);

// Void Reason Enum
export const VoidReason = z.enum([
  'CUSTOMER_CANCELLED',
  'PAYMENT_FAILED',
  'DUPLICATE_TRANSACTION',
  'PRICING_ERROR',
  'SYSTEM_ERROR',
  'OTHER'
]);

// Refund Item Schema
export const RefundItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantityToRefund: z.number().positive(),
  refundAmount: z.number().nonnegative(),
});

// Create Refund Schema
export const CreateRefundSchema = z.object({
  saleId: z.string().uuid(),
  refundType: RefundType,
  refundReason: RefundReason,
  items: z.array(RefundItemSchema).min(1, 'At least one item must be refunded'),
  returnToInventory: z.boolean().default(true),
  refundAmount: z.number().positive({ message: 'Refund amount must be greater than zero' }),
  notes: z.string().max(500).optional(),
});

// Void Sale Schema
export const VoidSaleSchema = z.object({
  saleId: z.string().uuid(),
  voidReason: VoidReason,
  notes: z.string().min(3, 'Void reason notes must be at least 3 characters').max(500),
});

// Type exports
export type RefundItem = z.infer<typeof RefundItemSchema>;
export type CreateRefund = z.infer<typeof CreateRefundSchema>;
export type VoidSale = z.infer<typeof VoidSaleSchema>;
