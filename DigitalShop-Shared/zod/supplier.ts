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
  email: z.string().email('Invalid email format').optional(),
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
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  paymentTerms: z.string().max(50).nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

// Inferred types
export type Supplier = z.infer<typeof SupplierSchema>;
export type CreateSupplier = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplier = z.infer<typeof UpdateSupplierSchema>;
