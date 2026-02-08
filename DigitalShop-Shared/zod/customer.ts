import { z } from 'zod';

// Base customer schema - aligned with database schema
export const CustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  email: z.string().email().nullable(),
  phone: z.string().max(50).nullable(),
  address: z.string().nullable(),
  customerGroupId: z.string().uuid().nullable(),
  balance: z.number(),
  creditLimit: z.number().nonnegative(),
  isActive: z.boolean().default(true),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

// Schema for creating a customer
export const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(255),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  customerGroupId: z.string().uuid('Invalid customer group').optional(),
  creditLimit: z.number().nonnegative('Credit limit cannot be negative').optional().default(0),
  notes: z.string().optional(),
  isActive: z.boolean().optional().default(true),
}).strict();

// Schema for updating a customer
export const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().nullable().optional(),
  customerGroupId: z.string().uuid().nullable().optional(),
  creditLimit: z.number().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
}).strict();

// Inferred types
export type Customer = z.infer<typeof CustomerSchema>;
export type CreateCustomer = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomer = z.infer<typeof UpdateCustomerSchema>;
