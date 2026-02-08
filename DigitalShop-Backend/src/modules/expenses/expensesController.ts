import { Request, Response } from 'express';
import { z } from 'zod';
import { expensesService } from './expensesService.js';
import { logger } from '../../utils/logger.js';
// Import shared Zod validation schemas
import {
  CreateExpenseSchema,
  UpdateExpenseSchema,
  ExpenseFiltersSchema,
  CreateExpenseCategorySchema,
} from '../../../../DigitalShop-Shared/dist/zod/expense.js';

export const expensesController = {
  /**
   * GET /api/expenses
   * Get all expenses with optional filters
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        category: req.query.category as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        status: req.query.status as string | undefined,
      };

      const expenses = await expensesService.getAll(filters);
      res.json({ success: true, data: expenses });
    } catch (error: any) {
      logger.error('Error in getAll expenses:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
    }
  },

  /**
   * GET /api/expenses/categories
   * Get all expense categories
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await expensesService.getCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      logger.error('Error in getCategories:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense categories' });
    }
  },

  /**
   * GET /api/expenses/summary
   * Get expense summary
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const summary = await expensesService.getSummary(filters);
      res.json({ success: true, data: summary });
    } catch (error: any) {
      logger.error('Error in getSummary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense summary' });
    }
  },

  /**
   * GET /api/expenses/by-category
   * Get expenses grouped by category
   */
  async getByCategory(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };

      const data = await expensesService.getByCategory(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getByCategory:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expenses by category' });
    }
  },

  /**
   * GET /api/expenses/:id
   * Get expense by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const expense = await expensesService.getById(id);

      if (!expense) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      res.json({ success: true, data: expense });
    } catch (error: any) {
      logger.error('Error in getById expense:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense' });
    }
  },

  /**
   * POST /api/expenses
   * Create new expense
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const validated = CreateExpenseSchema.parse(req.body);

      const expense = await expensesService.create({
        ...validated,
        createdById: userId,
      });

      res.status(201).json({
        success: true,
        data: expense,
        message: 'Expense created successfully',
      });
    } catch (error: any) {
      logger.error('Error in create expense:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to create expense',
      });
    }
  },

  /**
   * PUT /api/expenses/:id
   * Update expense
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = UpdateExpenseSchema.parse(req.body);

      const expense = await expensesService.update(id, validated);

      if (!expense) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      res.json({
        success: true,
        data: expense,
        message: 'Expense updated successfully',
      });
    } catch (error: any) {
      logger.error('Error in update expense:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({ success: false, error: error.errors[0].message });
        return;
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Failed to update expense',
      });
    }
  },

  /**
   * DELETE /api/expenses/:id
   * Delete expense
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await expensesService.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Expense not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Expense deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error in delete expense:', error);
      res.status(500).json({ success: false, error: 'Failed to delete expense' });
    }
  },
};
