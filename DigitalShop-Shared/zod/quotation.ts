import { z } from 'zod';

// Quotation Status
export const QuotationStatusEnum = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']);

// Quotation Item (stored as JSONB)
export const QuotationItemSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  productName: z.string().min(1, 'Product name is required'),
  sku: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price cannot be negative'),
  taxRate: z.number().nonnegative().optional().default(0),
  discountAmount: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
});

// Create Quotation
export const CreateQuotationSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  items: z.array(QuotationItemSchema).min(1, 'At least one item is required'),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  notes: z.string().optional(),
  // Frontend-calculated totals (recalculated on backend)
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
});

// Update Quotation
export const UpdateQuotationSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().min(1).optional(),
  items: z.array(QuotationItemSchema).min(1).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().nullable().optional(),
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
});

// Inferred types
export type QuotationStatus = z.infer<typeof QuotationStatusEnum>;
export type QuotationItem = z.infer<typeof QuotationItemSchema>;
export type CreateQuotation = z.infer<typeof CreateQuotationSchema>;
export type UpdateQuotation = z.infer<typeof UpdateQuotationSchema>;
