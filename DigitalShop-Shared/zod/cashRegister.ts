import { z } from 'zod';

/**
 * Cash register session schemas
 */
export const SessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  openedAt: z.string(),
  closedAt: z.string().nullable(),
  openingFloat: z.number().nonnegative(),
  closingCash: z.number().nonnegative().optional(),
  expectedCash: z.number().nonnegative().optional(),
  cashVariance: z.number().optional(),
  totalCashSales: z.number().nonnegative().default(0),
  totalCardSales: z.number().nonnegative().default(0),
  totalMobileMoneySales: z.number().nonnegative().default(0),
  totalSales: z.number().nonnegative().default(0),
  status: z.enum(['OPEN', 'CLOSED', 'RECONCILED']),
  notes: z.string().optional(),
}).strict();

export const OpenSessionSchema = z.object({
  userId: z.string().uuid(),
  openingFloat: z.number().nonnegative().min(0, 'Opening float must be non-negative'),
  notes: z.string().optional(),
}).strict();

export const CloseSessionSchema = z.object({
  sessionId: z.string().uuid(),
  closingCash: z.number().nonnegative().min(0, 'Closing cash must be non-negative'),
  notes: z.string().optional(),
}).strict();

// Cash movement type enum - matches DB: cash_movement_type
export const CashMovementTypeEnum = z.enum([
  'CASH_IN', 'CASH_IN_FLOAT', 'CASH_IN_PAYMENT', 'CASH_IN_OTHER',
  'CASH_OUT', 'CASH_OUT_BANK', 'CASH_OUT_EXPENSE', 'CASH_OUT_OTHER',
  'SALE', 'REFUND', 'FLOAT_ADJUSTMENT',
]);

export const CashMovementSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  type: CashMovementTypeEnum,
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  createdBy: z.string().uuid(),
  createdAt: z.string(),
}).strict();

export const CreateCashMovementSchema = z.object({
  sessionId: z.string().uuid(),
  type: CashMovementTypeEnum,
  amount: z.number().positive().min(0.01, 'Amount must be greater than 0'),
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
}).strict();

export type Session = z.infer<typeof SessionSchema>;
export type OpenSession = z.infer<typeof OpenSessionSchema>;
export type CloseSession = z.infer<typeof CloseSessionSchema>;
export type CashMovement = z.infer<typeof CashMovementSchema>;
export type CreateCashMovement = z.infer<typeof CreateCashMovementSchema>;
export type CashMovementType = z.infer<typeof CashMovementTypeEnum>;
