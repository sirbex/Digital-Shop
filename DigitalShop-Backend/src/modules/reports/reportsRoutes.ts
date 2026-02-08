import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import { reportsController } from './reportsController.js';

const router = Router();

/**
 * All routes require authentication and Manager/Admin role
 */
router.use(authenticate);
router.use(requireManager);

// ============================================================================
// SALES REPORTS
// ============================================================================
router.get('/daily-sales', reportsController.getDailySalesReport);
router.get('/sales-details', reportsController.getSalesDetailsReport);
router.get('/sales-summary', reportsController.getSalesSummaryReport);
router.get('/sales-by-hour', reportsController.getSalesByHourReport);
router.get('/sales-by-cashier', reportsController.getSalesByCashierReport);
router.get('/sales-trends', reportsController.getSalesTrendsReport);
router.get('/payment-methods', reportsController.getPaymentMethodAnalysisReport);

// ============================================================================
// PROFIT & LOSS REPORTS
// ============================================================================
router.get('/profit-loss', reportsController.getProfitLossReport);

// ============================================================================
// CUSTOMER REPORTS
// ============================================================================
router.get('/customer-accounts', reportsController.getCustomerAccountsReport);
router.get('/customer-aging', reportsController.getCustomerAgingReport);

// ============================================================================
// INVENTORY REPORTS
// ============================================================================
router.get('/stock-valuation', reportsController.getStockValuationReport);
router.get('/inventory', reportsController.getInventoryReport);
router.get('/out-of-stock', reportsController.getOutOfStockReport);
router.get('/inventory-movements', reportsController.getInventoryMovementReport);
router.get('/slow-moving', reportsController.getSlowMovingProductsReport);
router.get('/fast-moving', reportsController.getFastMovingProductsReport);
router.get('/expiring-stock', reportsController.getExpiringStockReport);
router.get('/reorder', reportsController.getStockReorderReport);
router.get('/inventory-turnover', reportsController.getInventoryTurnoverReport);

// ============================================================================
// BEST SELLING REPORTS
// ============================================================================
router.get('/best-selling', reportsController.getBestSellingReport);
router.get('/best-selling-categories', reportsController.getBestSellingCategoriesReport);

// ============================================================================
// INVOICE REPORTS
// ============================================================================
router.get('/invoices', reportsController.getInvoicesReport);
router.get('/invoice-summary', reportsController.getInvoiceSummary);

// ============================================================================
// VOIDED & REFUND REPORTS
// ============================================================================
router.get('/voided', reportsController.getVoidedSalesReport);
router.get('/refunds', reportsController.getRefundReport);

// ============================================================================
// DISCOUNT REPORTS
// ============================================================================
router.get('/discounts', reportsController.getDiscountReport);
router.get('/discounts-by-cashier', reportsController.getDiscountSummaryByCashier);

// ============================================================================
// INCOME / PAYMENTS RECEIVED REPORTS
// ============================================================================
router.get('/payments-received', reportsController.getPaymentsReceivedReport);
router.get('/payments-summary', reportsController.getPaymentsSummaryReport);
router.get('/daily-collections', reportsController.getDailyCollectionsReport);

// ============================================================================
// EXPENSE REPORTS
// ============================================================================
router.get('/expenses', reportsController.getExpenseReport);
router.get('/expense-summary', reportsController.getExpenseSummaryReport);
router.get('/expense-by-category', reportsController.getExpenseByCategoryReport);
router.get('/daily-expenses', reportsController.getDailyExpenseReport);
router.get('/income-vs-expense', reportsController.getIncomeVsExpenseReport);

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================
router.get('/dashboard', reportsController.getDashboardSummary);

// ============================================================================
// LEGACY ROUTES (Backward Compatibility)
// ============================================================================
router.get('/sales', reportsController.getSalesReport);
router.get('/product-performance', reportsController.getProductPerformanceReport);
router.get('/daily-summary', reportsController.getDailySalesSummary);

export default router;
