import { z } from 'zod';

// Stock Adjustment Type Enum (maps to stock_movements.movement_type)
export const StockAdjustmentType = z.enum([
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'DAMAGE',
  'EXPIRY',
  'RETURN'
]);

// Stock Adjustment Schema (backed by stock_movements table)
export const StockAdjustmentSchema = z.object({
  id: z.string().uuid(),
  movementNumber: z.string(),
  productId: z.string().uuid(),
  productName: z.string().nullable(),
  sku: z.string().nullable(),
  batchId: z.string().uuid().nullable(),
  batchNumber: z.string().nullable(),
  adjustmentType: StockAdjustmentType,
  quantity: z.number(),
  unitCost: z.number().nullable(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  createdById: z.string().uuid().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
});

// Create Stock Adjustment Schema
export const CreateStockAdjustmentSchema = z.object({
  productId: z.string().uuid({ message: 'Product is required' }),
  batchId: z.string().uuid().optional(),
  adjustmentType: StockAdjustmentType,
  quantity: z.number()
    .positive({ message: 'Quantity must be positive' })
    .refine((val) => val !== 0, { message: 'Quantity cannot be zero' }),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().min(3, 'Reason must be at least 3 characters').max(500),
  notes: z.string().max(1000).optional(),
});

// Type exports
export type StockAdjustment = z.infer<typeof StockAdjustmentSchema>;
export type CreateStockAdjustmentInput = z.infer<typeof CreateStockAdjustmentSchema>;
export type CreateStockAdjustment = z.infer<typeof CreateStockAdjustmentSchema>;
