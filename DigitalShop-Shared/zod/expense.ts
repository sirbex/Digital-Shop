import { z } from 'zod';

// =============================================================================
// EXPENSE ZOD SCHEMAS
// =============================================================================
// Validation schemas for expense tracking module
// Used by both backend controllers and frontend forms
// =============================================================================

// Payment Method Enum (reusable)
export const ExpensePaymentMethod = z.enum([
  'CASH',
  'CARD',
  'MOBILE_MONEY',
  'BANK_TRANSFER',
]);

// Expense Status Enum
export const ExpenseStatus = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

// Recurring Frequency Enum
export const RecurringFrequency = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
]);

// =============================================================================
// EXPENSE CATEGORY SCHEMAS
// =============================================================================

export const ExpenseCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateExpenseCategorySchema = z.object({
  name: z.string()
    .min(1, 'Category name is required')
    .max(100, 'Category name must be at most 100 characters')
    .transform(val => val.trim()),
  description: z.string().max(500).optional(),
});

export const UpdateExpenseCategorySchema = CreateExpenseCategorySchema.partial();

// =============================================================================
// EXPENSE SCHEMAS
// =============================================================================

export const ExpenseSchema = z.object({
  id: z.string().uuid(),
  expenseNumber: z.string(),
  expenseDate: z.string(),
  category: z.string(),
  description: z.string(),
  amount: z.number(),
  paymentMethod: ExpensePaymentMethod,
  vendorName: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  receiptUrl: z.string().nullable(),
  notes: z.string().nullable(),
  isRecurring: z.boolean(),
  recurringFrequency: RecurringFrequency.nullable(),
  status: ExpenseStatus,
  createdById: z.string().uuid().nullable(),
  createdByName: z.string().nullable(),
  approvedById: z.string().uuid().nullable(),
  approvedByName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Create Expense Schema - used for POST /api/expenses
export const CreateExpenseSchema = z.object({
  expenseDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category must be at most 100 characters')
    .transform(val => val.trim()),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be at most 500 characters')
    .transform(val => val.trim()),
  amount: z.number()
    .positive('Amount must be greater than zero'),
  paymentMethod: ExpensePaymentMethod,
  vendorName: z.string()
    .max(255, 'Vendor name must be at most 255 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  referenceNumber: z.string()
    .max(100, 'Reference number must be at most 100 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be at most 1000 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  isRecurring: z.boolean().optional().default(false),
  recurringFrequency: RecurringFrequency.optional(),
}).refine(
  (data) => {
    // If recurring, frequency is required
    if (data.isRecurring && !data.recurringFrequency) {
      return false;
    }
    return true;
  },
  {
    message: 'Recurring frequency is required when expense is marked as recurring',
    path: ['recurringFrequency'],
  }
);

// Update Expense Schema - all fields optional
export const UpdateExpenseSchema = z.object({
  expenseDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category must be at most 100 characters')
    .transform(val => val?.trim())
    .optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be at most 500 characters')
    .transform(val => val?.trim())
    .optional(),
  amount: z.number()
    .positive('Amount must be greater than zero')
    .optional(),
  paymentMethod: ExpensePaymentMethod.optional(),
  vendorName: z.string()
    .max(255, 'Vendor name must be at most 255 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  referenceNumber: z.string()
    .max(100, 'Reference number must be at most 100 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be at most 1000 characters')
    .transform(val => val?.trim() || undefined)
    .optional(),
  isRecurring: z.boolean().optional(),
  recurringFrequency: RecurringFrequency.optional(),
});

// Expense Filters Schema - for query parameters
export const ExpenseFiltersSchema = z.object({
  startDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format')
    .optional(),
  endDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
    .optional(),
  category: z.string().optional(),
  paymentMethod: ExpensePaymentMethod.optional(),
  status: ExpenseStatus.optional(),
});

// Expense Summary Response Schema
export const ExpenseSummarySchema = z.object({
  totalCount: z.number(),
  totalAmount: z.number(),
  avgAmount: z.number(),
  minAmount: z.number().nullable(),
  maxAmount: z.number().nullable(),
});

// Expense By Category Response Schema
export const ExpenseByCategorySchema = z.object({
  category: z.string(),
  totalAmount: z.number(),
  count: z.number(),
  percentage: z.number(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ExpensePaymentMethod = z.infer<typeof ExpensePaymentMethod>;
export type ExpenseStatus = z.infer<typeof ExpenseStatus>;
export type RecurringFrequency = z.infer<typeof RecurringFrequency>;

export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;
export type CreateExpenseCategory = z.infer<typeof CreateExpenseCategorySchema>;
export type UpdateExpenseCategory = z.infer<typeof UpdateExpenseCategorySchema>;

export type Expense = z.infer<typeof ExpenseSchema>;
export type CreateExpense = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpense = z.infer<typeof UpdateExpenseSchema>;
export type ExpenseFilters = z.infer<typeof ExpenseFiltersSchema>;
export type ExpenseSummary = z.infer<typeof ExpenseSummarySchema>;
export type ExpenseByCategory = z.infer<typeof ExpenseByCategorySchema>;
