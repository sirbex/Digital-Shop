import { expensesRepository, ExpenseRow } from './expensesRepository.js';
import { logger } from '../../utils/logger.js';

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  vendorName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  isRecurring: boolean;
  recurringFrequency: string | null;
  status: string;
  createdById: string | null;
  createdByName: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    expenseNumber: row.expense_number,
    expenseDate: row.expense_date,
    category: row.category,
    description: row.description,
    amount: parseFloat(row.amount),
    paymentMethod: row.payment_method,
    vendorName: row.vendor_name,
    referenceNumber: row.reference_number,
    notes: row.notes,
    isRecurring: row.is_recurring,
    recurringFrequency: row.recurring_frequency,
    status: row.status,
    createdById: row.created_by_id,
    createdByName: row.created_by_name,
    approvedById: row.approved_by_id,
    approvedByName: row.approved_by_name,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const expensesService = {
  /**
   * Get all expenses
   */
  async getAll(filters?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    paymentMethod?: string;
    status?: string;
  }): Promise<Expense[]> {
    try {
      const rows = await expensesRepository.getAll(filters);
      return rows.map(toExpense);
    } catch (error: any) {
      logger.error('Failed to get expenses', { error, filters });
      throw error;
    }
  },

  /**
   * Get expense by ID
   */
  async getById(id: string): Promise<Expense | null> {
    try {
      const row = await expensesRepository.getById(id);
      return row ? toExpense(row) : null;
    } catch (error: any) {
      logger.error('Failed to get expense by ID', { error, id });
      throw error;
    }
  },

  /**
   * Create new expense
   */
  async create(data: {
    expenseDate: string;
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    vendorName?: string;
    referenceNumber?: string;
    notes?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
    createdById: string;
  }): Promise<Expense> {
    try {
      // Validate amount
      if (data.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const row = await expensesRepository.create(data);
      logger.info('Expense created', { expenseNumber: row.expense_number, amount: data.amount });
      return toExpense(row);
    } catch (error: any) {
      logger.error('Failed to create expense', { error, data });
      throw error;
    }
  },

  /**
   * Update expense
   */
  async update(id: string, data: {
    expenseDate?: string;
    category?: string;
    description?: string;
    amount?: number;
    paymentMethod?: string;
    vendorName?: string;
    referenceNumber?: string;
    notes?: string;
    isRecurring?: boolean;
    recurringFrequency?: string;
  }): Promise<Expense | null> {
    try {
      // Validate amount if provided
      if (data.amount !== undefined && data.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      const row = await expensesRepository.update(id, data);
      if (row) {
        logger.info('Expense updated', { id, expenseNumber: row.expense_number });
      }
      return row ? toExpense(row) : null;
    } catch (error: any) {
      logger.error('Failed to update expense', { error, id, data });
      throw error;
    }
  },

  /**
   * Delete expense
   */
  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await expensesRepository.delete(id);
      if (deleted) {
        logger.info('Expense deleted', { id });
      }
      return deleted;
    } catch (error: any) {
      logger.error('Failed to delete expense', { error, id });
      throw error;
    }
  },

  /**
   * Get all expense categories
   */
  async getCategories(): Promise<{ id: string; name: string; description: string | null }[]> {
    try {
      const rows = await expensesRepository.getCategories();
      return rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
      }));
    } catch (error: any) {
      logger.error('Failed to get expense categories', { error });
      throw error;
    }
  },

  /**
   * Get expense summary
   */
  async getSummary(filters?: { startDate?: string; endDate?: string }): Promise<{
    totalCount: number;
    totalAmount: number;
    avgAmount: number;
    minAmount: number;
    maxAmount: number;
  }> {
    try {
      const summary = await expensesRepository.getSummary(filters);
      return {
        totalCount: parseInt(summary.total_count) || 0,
        totalAmount: parseFloat(summary.total_amount) || 0,
        avgAmount: parseFloat(summary.avg_amount) || 0,
        minAmount: parseFloat(summary.min_amount) || 0,
        maxAmount: parseFloat(summary.max_amount) || 0,
      };
    } catch (error: any) {
      logger.error('Failed to get expense summary', { error, filters });
      throw error;
    }
  },

  /**
   * Get expenses grouped by category
   */
  async getByCategory(filters?: { startDate?: string; endDate?: string }): Promise<{
    category: string;
    expenseCount: number;
    totalAmount: number;
  }[]> {
    try {
      const rows = await expensesRepository.getByCategory(filters);
      return rows.map(row => ({
        category: row.category,
        expenseCount: parseInt(row.expense_count) || 0,
        totalAmount: parseFloat(row.total_amount) || 0,
      }));
    } catch (error: any) {
      logger.error('Failed to get expenses by category', { error, filters });
      throw error;
    }
  },
};
