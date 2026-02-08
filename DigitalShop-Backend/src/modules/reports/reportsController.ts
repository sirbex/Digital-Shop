import { Request, Response } from 'express';
import { reportsService } from './reportsService.js';
import { logger } from '../../utils/logger.js';

export const reportsController = {
  // ============================================================================
  // SALES REPORTS
  // ============================================================================

  /**
   * GET /api/reports/daily-sales
   * Daily sales report with hourly breakdown
   */
  async getDailySalesReport(req: Request, res: Response): Promise<void> {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const data = await reportsService.getDailySalesReport(date);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDailySalesReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch daily sales report' });
    }
  },

  /**
   * GET /api/reports/sales-details
   * Detailed sales transactions with items
   */
  async getSalesDetailsReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        customerId: req.query.customerId as string | undefined,
        cashierId: req.query.cashierId as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
        status: req.query.status as string | undefined,
      };
      const data = await reportsService.getSalesDetailsReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesDetailsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales details report' });
    }
  },

  /**
   * GET /api/reports/sales-summary
   * Sales summary with totals and breakdowns
   */
  async getSalesSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }

      const data = await reportsService.getSalesSummaryReport(startDate, endDate);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesSummaryReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales summary report' });
    }
  },

  // ============================================================================
  // PROFIT & LOSS REPORTS
  // ============================================================================

  /**
   * GET /api/reports/profit-loss
   * Comprehensive profit and loss statement
   */
  async getProfitLossReport(req: Request, res: Response): Promise<void> {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }

      const data = await reportsService.getProfitLossReport(startDate, endDate);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getProfitLossReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch profit & loss report' });
    }
  },

  // ============================================================================
  // CUSTOMER REPORTS
  // ============================================================================

  /**
   * GET /api/reports/customer-accounts
   * Customer accounts with balances and transaction counts
   */
  async getCustomerAccountsReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        hasBalance: req.query.hasBalance === 'true' ? true : req.query.hasBalance === 'false' ? false : undefined,
        customerId: req.query.customerId as string | undefined,
      };
      const data = await reportsService.getCustomerAccountsReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getCustomerAccountsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer accounts report' });
    }
  },

  /**
   * GET /api/reports/customer-aging
   * Customer aging report with buckets (current, 1-30, 31-60, 61-90, 90+)
   */
  async getCustomerAgingReport(_req: Request, res: Response): Promise<void> {
    try {
      const data = await reportsService.getCustomerAgingReport();
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getCustomerAgingReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch customer aging report' });
    }
  },

  // ============================================================================
  // INVENTORY REPORTS
  // ============================================================================

  /**
   * GET /api/reports/stock-valuation
   * Stock valuation by costing method
   */
  async getStockValuationReport(req: Request, res: Response): Promise<void> {
    try {
      const costingMethod = (req.query.costingMethod as string) || 'FIFO';
      const data = await reportsService.getStockValuationReport(costingMethod);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getStockValuationReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock valuation report' });
    }
  },

  /**
   * GET /api/reports/inventory
   * Comprehensive inventory report
   */
  async getInventoryReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        lowStock: req.query.lowStock === 'true',
        expiringSoon: req.query.expiringSoon === 'true',
        categoryId: req.query.categoryId as string | undefined,
      };
      const data = await reportsService.getInventoryReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getInventoryReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch inventory report' });
    }
  },

  /**
   * GET /api/reports/out-of-stock
   * Out of stock products
   */
  async getOutOfStockReport(_req: Request, res: Response): Promise<void> {
    try {
      const data = await reportsService.getOutOfStockReport();
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getOutOfStockReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch out of stock report' });
    }
  },

  // ============================================================================
  // BEST SELLING REPORTS
  // ============================================================================

  /**
   * GET /api/reports/best-selling
   * Best selling products report
   */
  async getBestSellingReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        sortBy: (req.query.sortBy as string) || 'quantity', // quantity, revenue, profit
      };
      const data = await reportsService.getBestSellingReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getBestSellingReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch best selling report' });
    }
  },

  /**
   * GET /api/reports/best-selling-categories
   * Best selling categories report
   */
  async getBestSellingCategoriesReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const data = await reportsService.getBestSellingCategoriesReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getBestSellingCategoriesReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch best selling categories report' });
    }
  },

  // ============================================================================
  // INVOICE REPORTS
  // ============================================================================

  /**
   * GET /api/reports/invoices
   * Invoices report with detailed information
   */
  async getInvoicesReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        customerId: req.query.customerId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const data = await reportsService.getInvoicesReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getInvoicesReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch invoices report' });
    }
  },

  /**
   * GET /api/reports/invoice-summary
   * Invoice summary with status breakdown
   */
  async getInvoiceSummary(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const data = await reportsService.getInvoiceSummary(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getInvoiceSummary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch invoice summary' });
    }
  },

  // ============================================================================
  // VOIDED & REFUND REPORTS
  // ============================================================================

  /**
   * GET /api/reports/voided
   * Voided sales report
   */
  async getVoidedSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const data = await reportsService.getVoidedSalesReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getVoidedSalesReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch voided sales report' });
    }
  },

  /**
   * GET /api/reports/refunds
   * Refunds report
   */
  async getRefundReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const data = await reportsService.getRefundReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getRefundReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch refund report' });
    }
  },

  // ============================================================================
  // DASHBOARD SUMMARY
  // ============================================================================

  /**
   * GET /api/reports/dashboard
   * Dashboard summary with key metrics
   */
  async getDashboardSummary(_req: Request, res: Response): Promise<void> {
    try {
      const data = await reportsService.getDashboardSummary();
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDashboardSummary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary' });
    }
  },

  // ============================================================================
  // LEGACY ENDPOINTS (Backward Compatibility)
  // ============================================================================

  /**
   * GET /api/reports/sales (Legacy)
   */
  async getSalesReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        customerId: req.query.customerId as string | undefined,
        paymentMethod: req.query.paymentMethod as string | undefined,
      };
      const data = await reportsService.getSalesReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales report' });
    }
  },

  /**
   * GET /api/reports/product-performance (Legacy)
   */
  async getProductPerformanceReport(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };
      const data = await reportsService.getProductPerformanceReport(filters);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getProductPerformanceReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch product performance report' });
    }
  },

  /**
   * GET /api/reports/daily-summary (Legacy)
   */
  async getDailySalesSummary(req: Request, res: Response): Promise<void> {
    try {
      const date = req.query.date as string;
      if (!date) {
        res.status(400).json({ success: false, error: 'Date is required' });
        return;
      }
      const data = await reportsService.getDailySalesSummary(date);
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDailySalesSummary:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch daily sales summary' });
    }
  },

  // ==========================================================================
  // ADDITIONAL SALES REPORTS
  // ==========================================================================

  /**
   * GET /api/reports/sales-by-hour
   */
  async getSalesByHourReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getSalesByHourReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesByHourReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by hour report' });
    }
  },

  /**
   * GET /api/reports/sales-by-cashier
   */
  async getSalesByCashierReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getSalesByCashierReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesByCashierReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales by cashier report' });
    }
  },

  /**
   * GET /api/reports/sales-trends
   */
  async getSalesTrendsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getSalesTrendsReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSalesTrendsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sales trends report' });
    }
  },

  /**
   * GET /api/reports/payment-methods
   */
  async getPaymentMethodAnalysisReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getPaymentMethodAnalysisReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getPaymentMethodAnalysisReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payment method analysis report' });
    }
  },

  // ==========================================================================
  // ADDITIONAL INVENTORY REPORTS
  // ==========================================================================

  /**
   * GET /api/reports/inventory-movements
   */
  async getInventoryMovementReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, productId, movementType } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getInventoryMovementReport({
        startDate: startDate as string,
        endDate: endDate as string,
        productId: productId as string | undefined,
        movementType: movementType as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getInventoryMovementReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch inventory movement report' });
    }
  },

  /**
   * GET /api/reports/slow-moving
   */
  async getSlowMovingProductsReport(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const data = await reportsService.getSlowMovingProductsReport({ days });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getSlowMovingProductsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch slow moving products report' });
    }
  },

  /**
   * GET /api/reports/fast-moving
   */
  async getFastMovingProductsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, limit } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getFastMovingProductsReport({
        startDate: startDate as string,
        endDate: endDate as string,
        limit: limit ? parseInt(limit as string) : 20,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getFastMovingProductsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch fast moving products report' });
    }
  },

  /**
   * GET /api/reports/expiring-stock
   */
  async getExpiringStockReport(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const data = await reportsService.getExpiringStockReport({ days });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getExpiringStockReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expiring stock report' });
    }
  },

  /**
   * GET /api/reports/reorder
   */
  async getStockReorderReport(req: Request, res: Response): Promise<void> {
    try {
      const data = await reportsService.getStockReorderReport();
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getStockReorderReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch stock reorder report' });
    }
  },

  /**
   * GET /api/reports/inventory-turnover
   */
  async getInventoryTurnoverReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getInventoryTurnoverReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getInventoryTurnoverReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch inventory turnover report' });
    }
  },

  /**
   * GET /api/reports/discounts
   */
  async getDiscountReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getDiscountReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDiscountReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch discount report' });
    }
  },

  /**
   * GET /api/reports/discounts-by-cashier
   */
  async getDiscountSummaryByCashier(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getDiscountSummaryByCashier({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDiscountSummaryByCashier:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch discount summary by cashier' });
    }
  },

  // ============================================================================
  // INCOME / PAYMENTS RECEIVED REPORTS
  // ============================================================================

  /**
   * GET /api/reports/payments-received
   * Payments collected from customers (debt payments)
   */
  async getPaymentsReceivedReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, customerId, paymentMethod } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getPaymentsReceivedReport({
        startDate: startDate as string,
        endDate: endDate as string,
        customerId: customerId as string | undefined,
        paymentMethod: paymentMethod as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getPaymentsReceivedReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments received report' });
    }
  },

  /**
   * GET /api/reports/payments-summary
   * Summary of payments collected
   */
  async getPaymentsSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getPaymentsSummaryReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getPaymentsSummaryReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch payments summary report' });
    }
  },

  /**
   * GET /api/reports/daily-collections
   * Daily breakdown of payments collected
   */
  async getDailyCollectionsReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getDailyCollectionsReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDailyCollectionsReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch daily collections report' });
    }
  },

  // ============================================================================
  // EXPENSE REPORTS
  // ============================================================================

  /**
   * GET /api/reports/expenses
   * All expenses with details
   */
  async getExpenseReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, category, paymentMethod } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getExpenseReport({
        startDate: startDate as string,
        endDate: endDate as string,
        category: category as string | undefined,
        paymentMethod: paymentMethod as string | undefined,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getExpenseReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense report' });
    }
  },

  /**
   * GET /api/reports/expense-summary
   * Summary of all expenses
   */
  async getExpenseSummaryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getExpenseSummaryReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getExpenseSummaryReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense summary report' });
    }
  },

  /**
   * GET /api/reports/expense-by-category
   * Expenses grouped by category
   */
  async getExpenseByCategoryReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getExpenseByCategoryReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getExpenseByCategoryReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch expense by category report' });
    }
  },

  /**
   * GET /api/reports/daily-expenses
   * Daily breakdown of expenses
   */
  async getDailyExpenseReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getDailyExpenseReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getDailyExpenseReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch daily expense report' });
    }
  },

  /**
   * GET /api/reports/income-vs-expense
   * Combined income vs expense report
   */
  async getIncomeVsExpenseReport(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Start date and end date are required' });
        return;
      }
      const data = await reportsService.getIncomeVsExpenseReport({
        startDate: startDate as string,
        endDate: endDate as string,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      logger.error('Error in getIncomeVsExpenseReport:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch income vs expense report' });
    }
  },
};







