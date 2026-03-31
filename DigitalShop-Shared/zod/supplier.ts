import { z } from 'zod';

// Base supplier schema - aligned with database schema
export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  contactPerson: z.string().max(255).nullable(),
  email: z.string().email().nullable(),
  phone: z.string().max(50).nullable(),
  address: z.string().nullable(),
  paymentTerms: z.string().max(50).nullable(),
  balance: z.number(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

// Schema for creating a supplier
export const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(255),
  contactPerson: z.string().max(255).optional(),
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().email('Invalid email format').optional()
  ),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  paymentTerms: z.string().max(50).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional().default(true),
}).strict();

// Schema for updating a supplier
export const UpdateSupplierSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contactPerson: z.string().max(255).nullable().optional(),
  email: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
    z.string().email('Invalid email format').nullable().optional()
  ),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  paymentTerms: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

// Schema for recording a supplier payment
export const RecordSupplierPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHECK']),
  paymentDate: z.string().optional(),
  purchaseOrderId: z.string().uuid().nullable().optional(),
  referenceNumber: z.string().max(200).optional(),
  notes: z.string().optional(),
  // Check-specific fields (required when paymentMethod is CHECK)
  checkNumber: z.string().max(50).optional(),
  checkStatus: z.enum(['RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'VOIDED']).optional(),
  bankName: z.string().max(100).optional(),
  checkDate: z.string().optional(),
}).strict();

// Supplier payment response schema
export const SupplierPaymentSchema = z.object({
  id: z.string().uuid(),
  receiptNumber: z.string(),
  supplierId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().nullable(),
  paymentDate: z.string(),
  paymentMethod: z.string(),
  amount: z.number(),
  referenceNumber: z.string().nullable(),
  notes: z.string().nullable(),
  processedById: z.string().uuid().nullable(),
  createdAt: z.string(),
  checkNumber: z.string().nullable().optional(),
  checkStatus: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  checkDate: z.string().nullable().optional(),
});

// Inferred types
export type Supplier = z.infer<typeof SupplierSchema>;
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;
export type RecordSupplierPayment = z.infer<typeof RecordSupplierPaymentSchema>;
export type SupplierPayment = z.infer<typeof SupplierPaymentSchema>;
