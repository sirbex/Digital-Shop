import { z } from 'zod';

// Costing method enum
export const CostingMethodEnum = z.enum(['FIFO', 'AVCO', 'STANDARD']);

// Base product schema - aligned with database schema
export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).nullable(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  category: z.string().max(100).nullable(),
  unitOfMeasure: z.string().max(50).default('PCS'),
  conversionFactor: z.number().positive().default(1.0000),
  costPrice: z.number().nonnegative().default(0),
  sellingPrice: z.number().nonnegative().default(0),
  costingMethod: CostingMethodEnum.default('FIFO'),
  averageCost: z.number().nonnegative().default(0),
  lastCost: z.number().nonnegative().default(0),
  pricingFormula: z.string().nullable(),
  autoUpdatePrice: z.boolean().default(false),
  quantityOnHand: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
  trackExpiry: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  taxRate: z.number().min(0).max(1).default(0.06),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
}).strict();

// Schema for creating a product
export const CreateProductSchema = z.object({
  sku: z.string().max(100).optional(), // Optional - will be auto-generated if not provided
  barcode: z.string().max(100).optional(),
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  unitOfMeasure: z.string().max(50).optional().default('PCS'),
  conversionFactor: z.number().positive().optional().default(1.0000),
  costPrice: z.number().nonnegative('Cost price cannot be negative').default(0),
  sellingPrice: z.number().nonnegative('Selling price cannot be negative').default(0),
  costingMethod: CostingMethodEnum.optional().default('FIFO'),
  pricingFormula: z.string().optional(),
  autoUpdatePrice: z.boolean().optional().default(false),
  reorderLevel: z.number().nonnegative().optional().default(0),
  trackExpiry: z.boolean().optional().default(false),
  isTaxable: z.boolean().optional().default(true),
  taxRate: z.number()
    .min(0, 'Tax rate cannot be negative')
    .max(1, 'Tax rate must be a decimal (e.g., 0.06 for 6%). Enter values between 0 and 1.')
    .optional()
    .default(0.06),
  isActive: z.boolean().optional().default(true),
}).strict();

// Schema for updating a product
export const UpdateProductSchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  unitOfMeasure: z.string().max(50).optional(),
  conversionFactor: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  costingMethod: CostingMethodEnum.optional(),
  pricingFormula: z.string().nullable().optional(),
  autoUpdatePrice: z.boolean().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  trackExpiry: z.boolean().optional(),
  isTaxable: z.boolean().optional(),
  taxRate: z.number().min(0).max(1).optional(),
  isActive: z.boolean().optional(),
}).strict();

// Inferred types
export type CostingMethod = z.infer<typeof CostingMethodEnum>;
export type Product = z.infer<typeof ProductSchema>;
export type CreateProduct = z.infer<typeof CreateProductSchema>;
export type UpdateProduct = z.infer<typeof UpdateProductSchema>;
