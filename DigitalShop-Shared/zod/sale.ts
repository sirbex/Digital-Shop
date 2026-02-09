import { z } from 'zod';

// Sale item type enum
export const SaleItemTypeEnum = z.enum(['PRODUCT', 'SERVICE', 'CUSTOM']);

// Sale status enum
export const SaleStatusEnum = z.enum(['COMPLETED', 'VOID', 'REFUNDED']);

// Payment method enum
export const PaymentMethodEnum = z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CREDIT']);

// Sale item schema
export const SaleItemSchema = z.object({
  id: z.string().uuid(),
  saleId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  subtotal: z.number().nonnegative(),
  total: z.number().nonnegative(),
  costPrice: z.number().nonnegative().nullable(),
  batchId: z.string().uuid().nullable(),
  createdAt: z.date(),
}).strict();

// Base sale schema
export const SaleSchema = z.object({
  id: z.string().uuid(),
  saleNumber: z.string(),
  customerId: z.string().uuid().nullable(),
  cashRegisterId: z.string().uuid().nullable(),
  sessionId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  saleDate: z.date(),
  subtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  amountPaid: z.number().nonnegative(),
  changeAmount: z.number().nonnegative(),
  paymentMethod: PaymentMethodEnum,
  status: SaleStatusEnum,
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

// Schema for creating a sale
export const CreateSaleSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').nullable().optional(),
  cashRegisterId: z.string().uuid('Invalid cash register ID').nullable().optional(),
  sessionId: z.string().uuid('Invalid session ID').nullable().optional(),
  items: z.array(z.object({
    productId: z.string().uuid('Invalid product ID').nullable().optional(),
    itemType: SaleItemTypeEnum.optional().default('PRODUCT'),
    customDescription: z.string().min(1, 'Description required for service/custom items').optional(),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().nonnegative('Unit price cannot be negative'),
    discountAmount: z.number().nonnegative('Discount cannot be negative').optional().default(0),
    taxRate: z.number().nonnegative('Tax rate cannot be negative').optional(),
    batchId: z.string().uuid().nullable().optional(),
  })).min(1, 'At least one item is required'),
  paymentMethod: PaymentMethodEnum,
  amountPaid: z.number().nonnegative('Amount paid cannot be negative'),
  notes: z.string().nullable().optional(),
  // Allow calculated fields from frontend (will be recalculated on backend)
  subtotal: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  saleDate: z.string().optional(), // For backdated sales
});

// Sales filter schema for querying sales history
export const SalesFilterSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().or(z.literal('')),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional().or(z.literal('')),
  paymentMethod: PaymentMethodEnum.optional().or(z.literal('')),
  status: SaleStatusEnum.optional().or(z.literal('')),
  customerId: z.string().uuid().optional().or(z.literal('')),
  minAmount: z.number().nonnegative().optional(),
  maxAmount: z.number().nonnegative().optional(),
}).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before or equal to end date', path: ['endDate'] }
);

// Print receipt action schema
export const PrintReceiptSchema = z.object({
  saleId: z.string().uuid('Invalid sale ID'),
});

// Inferred types
export type SaleItemType = z.infer<typeof SaleItemTypeEnum>;
export type SaleStatus = z.infer<typeof SaleStatusEnum>;
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;
export type SaleItem = z.infer<typeof SaleItemSchema>;
export type Sale = z.infer<typeof SaleSchema>;
export type CreateSale = z.infer<typeof CreateSaleSchema>;
export type SalesFilter = z.infer<typeof SalesFilterSchema>;
export type PrintReceipt = z.infer<typeof PrintReceiptSchema>;
