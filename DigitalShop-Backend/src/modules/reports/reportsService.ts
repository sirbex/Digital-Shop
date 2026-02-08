import { reportsRepository } from './reportsRepository.js';
import { logger } from '../../utils/logger.js';

export const reportsService = {
  // ==========================================================================
  // SALES REPORTS
  // ==========================================================================

  /**
   * Daily Sales Report
   */
  async getDailySalesReport(date?: string) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      return await reportsRepository.getDailySalesReport({ startDate: targetDate, endDate: targetDate });
    } catch (error: any) {
      logger.error('Failed to get daily sales report', { error, date });
      throw error;
    }
  },

  /**
   * Sales Details Report
   */
  async getSalesDetailsReport(filters?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    cashierId?: string;
    paymentMethod?: string;
    status?: string;
  }) {
    try {
      const safeFilters = {
        startDate: filters?.startDate || '2000-01-01',
        endDate: filters?.endDate || '2100-12-31',
        customerId: filters?.customerId,
        cashierId: filters?.cashierId,
        paymentMethod: filters?.paymentMethod,
      };
      return await reportsRepository.getSalesDetailsReport(safeFilters);
    } catch (error: any) {
      logger.error('Failed to get sales details report', { error, filters });
      throw error;
    }
  },

  /**
   * Sales Summary Report
   */
  async getSalesSummaryReport(startDate: string, endDate: string) {
    try {
      return await reportsRepository.getSalesSummaryReport({ startDate, endDate });
    } catch (error: any) {
      logger.error('Failed to get sales summary report', { error });
      throw error;
    }
  },

  // ==========================================================================
  // PROFIT & LOSS REPORT
  // ==========================================================================

  /**
   * Profit & Loss Report
   */
  async getProfitLossReport(startDate: string, endDate: string) {
    try {
      return await reportsRepository.getProfitLossReport(startDate, endDate);
    } catch (error: any) {
      logger.error('Failed to get profit & loss report', { error });
      throw error;
    }
  },

  // ==========================================================================
  // CUSTOMER REPORTS
  // ==========================================================================

  /**
   * Customer Accounts Report
   */
  async getCustomerAccountsReport(filters?: { hasBalance?: boolean; customerId?: string }) {
    try {
      return await reportsRepository.getCustomerAccountsReport(filters);
    } catch (error: any) {
      logger.error('Failed to get customer accounts report', { error, filters });
      throw error;
    }
  },

  /**
   * Customer Aging Report
   */
  async getCustomerAgingReport() {
    try {
      return await reportsRepository.getCustomerAgingReport();
    } catch (error: any) {
      logger.error('Failed to get customer aging report', { error });
      throw error;
    }
  },

  // ==========================================================================
  // INVENTORY REPORTS
  // ==========================================================================

  /**
   * Stock Valuation Report
   */
  async getStockValuationReport(costingMethod?: string) {
    try {
      return await reportsRepository.getStockValuationReport(costingMethod);
    } catch (error: any) {
      logger.error('Failed to get stock valuation report', { error });
      throw error;
    }
  },

  /**
   * Inventory Report
   */
  async getInventoryReport(filters?: {
    lowStock?: boolean;
    outOfStock?: boolean;
    expiringSoon?: boolean;
    categoryId?: string;
  }) {
    try {
      return await reportsRepository.getInventoryReport(filters);
    } catch (error: any) {
      logger.error('Failed to get inventory report', { error, filters });
      throw error;
    }
  },

  /**
   * Out of Stock Report
   */
  async getOutOfStockReport() {
    try {
      return await reportsRepository.getOutOfStockReport();
    } catch (error: any) {
      logger.error('Failed to get out of stock report', { error });
      throw error;
    }
  },

  // ==========================================================================
  // BEST SELLING REPORTS
  // ==========================================================================

  /**
   * Best Selling Products Report
   */
  async getBestSellingReport(filters?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    sortBy?: string;
  }) {
    try {
      const safeFilters = {
        startDate: filters?.startDate || '2000-01-01',
        endDate: filters?.endDate || '2100-12-31',
        limit: filters?.limit,
        sortBy: (filters?.sortBy || 'quantity') as 'quantity' | 'revenue' | 'profit',
      };
      return await reportsRepository.getBestSellingReport(safeFilters);
    } catch (error: any) {
      logger.error('Failed to get best selling report', { error, filters });
      throw error;
    }
  },

  /**
   * Best Selling Categories Report
   */
  async getBestSellingCategoriesReport(filters?: { startDate?: string; endDate?: string }) {
    try {
      const safeFilters = {
        startDate: filters?.startDate || '2000-01-01',
        endDate: filters?.endDate || '2100-12-31',
      };
      return await reportsRepository.getBestSellingCategoriesReport(safeFilters);
    } catch (error: any) {
      logger.error('Failed to get best selling categories report', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // INVOICE REPORTS
  // ==========================================================================

  /**
   * Invoices Report
   */
  async getInvoicesReport(filters?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    customerId?: string;
  }) {
    try {
      return await reportsRepository.getInvoicesReport(filters || {});
    } catch (error: any) {
      logger.error('Failed to get invoices report', { error, filters });
      throw error;
    }
  },

  /**
   * Invoice Summary
   */
  async getInvoiceSummary(filters?: { startDate?: string; endDate?: string }) {
    try {
      return await reportsRepository.getInvoiceSummary(filters || {});
    } catch (error: any) {
      logger.error('Failed to get invoice summary', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // VOIDED & REFUND REPORTS
  // ==========================================================================

  /**
   * Voided Sales Report
   */
  async getVoidedSalesReport(filters?: { startDate?: string; endDate?: string }) {
    try {
      const safeFilters = {
        startDate: filters?.startDate || '2000-01-01',
        endDate: filters?.endDate || '2100-12-31',
      };
      return await reportsRepository.getVoidedSalesReport(safeFilters);
    } catch (error: any) {
      logger.error('Failed to get voided sales report', { error, filters });
      throw error;
    }
  },

  /**
   * Refund Report
   */
  async getRefundReport(filters?: { startDate?: string; endDate?: string }) {
    try {
      const safeFilters = {
        startDate: filters?.startDate || '2000-01-01',
        endDate: filters?.endDate || '2100-12-31',
      };
      return await reportsRepository.getRefundReport(safeFilters);
    } catch (error: any) {
      logger.error('Failed to get refund report', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // DASHBOARD / QUICK REPORTS
  // ==========================================================================

  /**
   * Dashboard Summary
   */
  async getDashboardSummary() {
    try {
      return await reportsRepository.getDashboardSummary();
    } catch (error: any) {
      logger.error('Failed to get dashboard summary', { error });
      throw error;
    }
  },

  // ==========================================================================
  // ADDITIONAL SALES REPORTS
  // ==========================================================================

  /**
   * Sales by Hour Report
   */
  async getSalesByHourReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getSalesByHourReport(filters);
    } catch (error: any) {
      logger.error('Failed to get sales by hour report', { error, filters });
      throw error;
    }
  },

  /**
   * Sales by Cashier Report
   */
  async getSalesByCashierReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getSalesByCashierReport(filters);
    } catch (error: any) {
      logger.error('Failed to get sales by cashier report', { error, filters });
      throw error;
    }
  },

  /**
   * Sales Trends Report
   */
  async getSalesTrendsReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getSalesTrendsReport(filters);
    } catch (error: any) {
      logger.error('Failed to get sales trends report', { error, filters });
      throw error;
    }
  },

  /**
   * Payment Method Analysis Report
   */
  async getPaymentMethodAnalysisReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getPaymentMethodAnalysisReport(filters);
    } catch (error: any) {
      logger.error('Failed to get payment method analysis report', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // ADDITIONAL INVENTORY REPORTS
  // ==========================================================================

  /**
   * Inventory Movement Report
   */
  async getInventoryMovementReport(filters: {
    startDate: string;
    endDate: string;
    productId?: string;
    movementType?: string;
  }) {
    try {
      return await reportsRepository.getInventoryMovementReport(filters);
    } catch (error: any) {
      logger.error('Failed to get inventory movement report', { error, filters });
      throw error;
    }
  },

  /**
   * Slow Moving Products Report
   */
  async getSlowMovingProductsReport(filters?: { days?: number }) {
    try {
      return await reportsRepository.getSlowMovingProductsReport(filters || {});
    } catch (error: any) {
      logger.error('Failed to get slow moving products report', { error, filters });
      throw error;
    }
  },

  /**
   * Fast Moving Products Report
   */
  async getFastMovingProductsReport(filters: { startDate: string; endDate: string; limit?: number }) {
    try {
      return await reportsRepository.getFastMovingProductsReport(filters);
    } catch (error: any) {
      logger.error('Failed to get fast moving products report', { error, filters });
      throw error;
    }
  },

  /**
   * Expiring Stock Report
   */
  async getExpiringStockReport(filters?: { days?: number }) {
    try {
      return await reportsRepository.getExpiringStockReport(filters || {});
    } catch (error: any) {
      logger.error('Failed to get expiring stock report', { error, filters });
      throw error;
    }
  },

  /**
   * Stock Reorder Report
   */
  async getStockReorderReport() {
    try {
      return await reportsRepository.getStockReorderReport();
    } catch (error: any) {
      logger.error('Failed to get stock reorder report', { error });
      throw error;
    }
  },

  /**
   * Inventory Turnover Report
   */
  async getInventoryTurnoverReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getInventoryTurnoverReport(filters);
    } catch (error: any) {
      logger.error('Failed to get inventory turnover report', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // LEGACY FUNCTIONS (for backward compatibility)
  // ==========================================================================

  async getSalesReport(filters?: any) {
    return this.getSalesDetailsReport(filters);
  },

  async getProductPerformanceReport(filters?: any) {
    return this.getBestSellingReport({
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: filters?.limit,
      sortBy: 'revenue',
    });
  },

  async getDailySalesSummary(date: string) {
    return this.getDailySalesReport(date);
  },

  // ==========================================================================
  // DISCOUNT REPORTS
  // ==========================================================================

  /**
   * Discount Report - Shows all sales with discounts
   */
  async getDiscountReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getDiscountReport(filters);
    } catch (error: any) {
      logger.error('Failed to get discount report', { error, filters });
      throw error;
    }
  },

  /**
   * Discount Summary by Cashier
   */
  async getDiscountSummaryByCashier(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getDiscountSummaryByCashier(filters);
    } catch (error: any) {
      logger.error('Failed to get discount summary by cashier', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // INCOME / PAYMENTS RECEIVED REPORTS
  // ==========================================================================

  /**
   * Payments Received Report
   */
  async getPaymentsReceivedReport(filters: { startDate: string; endDate: string; customerId?: string; paymentMethod?: string }) {
    try {
      return await reportsRepository.getPaymentsReceivedReport(filters);
    } catch (error: any) {
      logger.error('Failed to get payments received report', { error, filters });
      throw error;
    }
  },

  /**
   * Payments Summary Report
   */
  async getPaymentsSummaryReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getPaymentsReceivedSummary(filters);
    } catch (error: any) {
      logger.error('Failed to get payments summary report', { error, filters });
      throw error;
    }
  },

  /**
   * Daily Collections Report
   */
  async getDailyCollectionsReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getDailyCollectionsReport(filters);
    } catch (error: any) {
      logger.error('Failed to get daily collections report', { error, filters });
      throw error;
    }
  },

  // ==========================================================================
  // EXPENSE REPORTS
  // ==========================================================================

  /**
   * Expense Report
   */
  async getExpenseReport(filters: { startDate: string; endDate: string; category?: string; paymentMethod?: string }) {
    try {
      return await reportsRepository.getExpenseReport(filters);
    } catch (error: any) {
      logger.error('Failed to get expense report', { error, filters });
      throw error;
    }
  },

  /**
   * Expense Summary Report
   */
  async getExpenseSummaryReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getExpenseSummary(filters);
    } catch (error: any) {
      logger.error('Failed to get expense summary report', { error, filters });
      throw error;
    }
  },

  /**
   * Expense by Category Report
   */
  async getExpenseByCategoryReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getExpenseByCategoryReport(filters);
    } catch (error: any) {
      logger.error('Failed to get expense by category report', { error, filters });
      throw error;
    }
  },

  /**
   * Daily Expense Report
   */
  async getDailyExpenseReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getDailyExpenseReport(filters);
    } catch (error: any) {
      logger.error('Failed to get daily expense report', { error, filters });
      throw error;
    }
  },

  /**
   * Income vs Expense Report
   */
  async getIncomeVsExpenseReport(filters: { startDate: string; endDate: string }) {
    try {
      return await reportsRepository.getIncomeVsExpenseReport(filters);
    } catch (error: any) {
      logger.error('Failed to get income vs expense report', { error, filters });
      throw error;
    }
  },
};