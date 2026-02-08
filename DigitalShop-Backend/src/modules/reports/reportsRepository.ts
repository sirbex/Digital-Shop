import pool from '../../db/pool.js';

export const reportsRepository = {
  // ==========================================================================
  // SALES REPORTS
  // ==========================================================================

  /**
   * Daily Sales Report - Sales for a specific date or date range
   */
  async getDailySalesReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        DATE(s.sale_date) as "date",
        COUNT(*) as "transactionCount",
        SUM(s.subtotal) as "subtotal",
        SUM(s.tax_amount) as "taxAmount",
        SUM(s.discount_amount) as "discountAmount",
        SUM(s.total_amount) as "totalAmount",
        SUM(s.total_cost) as "totalCost",
        SUM(s.profit) as "profit",
        AVG(s.profit_margin) * 100 as "avgProfitMargin",
        SUM(CASE WHEN s.payment_method = 'CASH' THEN s.amount_paid ELSE 0 END) as "cashSales",
        SUM(CASE WHEN s.payment_method = 'CARD' THEN s.amount_paid ELSE 0 END) as "cardSales",
        SUM(CASE WHEN s.payment_method = 'MOBILE_MONEY' THEN s.amount_paid ELSE 0 END) as "mobileMoneySales",
        SUM(CASE WHEN s.payment_method = 'CREDIT' THEN s.total_amount ELSE 0 END) as "creditSales",
        COUNT(CASE WHEN s.payment_method = 'CASH' THEN 1 END) as "cashTransactions",
        COUNT(CASE WHEN s.payment_method = 'CARD' THEN 1 END) as "cardTransactions",
        COUNT(CASE WHEN s.payment_method = 'MOBILE_MONEY' THEN 1 END) as "mobileMoneyTransactions",
        COUNT(CASE WHEN s.payment_method = 'CREDIT' THEN 1 END) as "creditTransactions"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY DATE(s.sale_date)
      ORDER BY DATE(s.sale_date) DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Sales Details Report - Individual sale transactions with items
   */
  async getSalesDetailsReport(filters: {
    startDate: string;
    endDate: string;
    customerId?: string;
    cashierId?: string;
    paymentMethod?: string;
  }) {
    let query = `
      SELECT 
        s.id,
        s.sale_number as "saleNumber",
        s.sale_date as "saleDate",
        c.name as "customerName",
        u.full_name as "cashierName",
        s.subtotal,
        s.tax_amount as "taxAmount",
        s.discount_amount as "discountAmount",
        s.total_amount as "totalAmount",
        s.total_cost as "totalCost",
        s.profit,
        s.profit_margin * 100 as "profitMargin",
        s.payment_method as "paymentMethod",
        s.amount_paid as "amountPaid",
        s.change_amount as "changeAmount",
        s.notes,
        (
          SELECT json_agg(json_build_object(
            'productName', p.name,
            'sku', p.sku,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'unitCost', si.unit_cost,
            'discount', si.discount_amount,
            'total', si.total_price,
            'profit', si.profit
          ))
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = s.id
        ) as "items"
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
    `;

    const values: any[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.customerId) {
      query += ` AND s.customer_id = $${paramIndex++}`;
      values.push(filters.customerId);
    }

    if (filters.cashierId) {
      query += ` AND s.cashier_id = $${paramIndex++}`;
      values.push(filters.cashierId);
    }

    if (filters.paymentMethod) {
      query += ` AND s.payment_method = $${paramIndex++}`;
      values.push(filters.paymentMethod);
    }

    query += ` ORDER BY s.sale_date DESC, s.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Sales Summary Report - Aggregated totals for period
   */
  async getSalesSummaryReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        COUNT(*) as "totalTransactions",
        SUM(s.subtotal) as "grossSales",
        SUM(s.tax_amount) as "totalTax",
        SUM(s.discount_amount) as "totalDiscount",
        SUM(s.total_amount) as "netSales",
        SUM(s.total_cost) as "costOfGoodsSold",
        SUM(s.profit) as "grossProfit",
        CASE WHEN SUM(s.total_amount) > 0 
          THEN (SUM(s.profit) / SUM(s.total_amount)) * 100 
          ELSE 0 
        END as "profitMarginPercent",
        AVG(s.total_amount) as "avgTransactionValue",
        MAX(s.total_amount) as "largestTransaction",
        MIN(s.total_amount) as "smallestTransaction",
        SUM(s.amount_paid) as "totalCollected",
        -- Payment method breakdown
        SUM(CASE WHEN s.payment_method = 'CASH' THEN s.amount_paid ELSE 0 END) as "cashCollected",
        SUM(CASE WHEN s.payment_method = 'CARD' THEN s.amount_paid ELSE 0 END) as "cardCollected",
        SUM(CASE WHEN s.payment_method = 'MOBILE_MONEY' THEN s.amount_paid ELSE 0 END) as "mobileMoneyCollected",
        COUNT(CASE WHEN s.payment_method = 'CASH' THEN 1 END) as "cashCount",
        COUNT(CASE WHEN s.payment_method = 'CARD' THEN 1 END) as "cardCount",
        COUNT(CASE WHEN s.payment_method = 'MOBILE_MONEY' THEN 1 END) as "mobileMoneyCount",
        COUNT(CASE WHEN s.payment_method = 'CREDIT' THEN 1 END) as "creditCount",
        -- Credit sales from invoices (single source of truth)
        (
          SELECT COALESCE(SUM(i.total_amount), 0)
          FROM invoices i
          LEFT JOIN sales ss ON i.sale_id = ss.id
          WHERE DATE(COALESCE(ss.sale_date, i.issue_date)) >= $1
            AND DATE(COALESCE(ss.sale_date, i.issue_date)) <= $2
        ) as "totalCreditSales",
        (
          SELECT COALESCE(SUM(i.amount_due), 0)
          FROM invoices i
          LEFT JOIN sales ss ON i.sale_id = ss.id
          WHERE i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
            AND DATE(COALESCE(ss.sale_date, i.issue_date)) >= $1
            AND DATE(COALESCE(ss.sale_date, i.issue_date)) <= $2
        ) as "creditOutstanding"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows[0];
  },

  // ==========================================================================
  // PROFIT & LOSS REPORT
  // ==========================================================================

  /**
   * Profit & Loss Report - Comprehensive P&L statement
   */
  async getProfitLossReport(startDate: string, endDate: string) {
    // Revenue from completed sales
    const revenueQuery = `
      SELECT 
        SUM(s.subtotal) as "grossRevenue",
        SUM(s.discount_amount) as "discounts",
        SUM(s.tax_amount) as "taxCollected",
        SUM(s.total_amount) as "netRevenue",
        SUM(s.amount_paid) as "cashReceived",
        COUNT(*) as "transactionCount"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
    `;

    // Cost of Goods Sold
    const cogsQuery = `
      SELECT 
        SUM(si.quantity * si.unit_cost) as "costOfGoodsSold"
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
    `;

    // Credit outstanding from invoices (single source of truth)
    const creditQuery = `
      SELECT 
        COALESCE(SUM(i.amount_due), 0) as "accountsReceivable"
      FROM invoices i
      LEFT JOIN sales s ON i.sale_id = s.id
      WHERE i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
        AND DATE(COALESCE(s.sale_date, i.issue_date)) >= $1
        AND DATE(COALESCE(s.sale_date, i.issue_date)) <= $2
    `;

    // Inventory value at period end
    const inventoryQuery = `
      SELECT 
        SUM(p.quantity_on_hand * p.cost_price) as "inventoryValue"
      FROM products p
      WHERE p.is_active = true
    `;

    // ========================================================================
    // OPERATING EXPENSES - Query expenses table for Net Profit calculation
    // ========================================================================
    const expensesQuery = `
      SELECT 
        COALESCE(SUM(e.amount), 0) as "totalExpenses",
        COUNT(*) as "expenseCount"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
    `;

    // Expense breakdown by category
    const expenseByCategoryQuery = `
      SELECT 
        e.category,
        COALESCE(SUM(e.amount), 0) as "amount",
        COUNT(*) as "count"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
      GROUP BY e.category
      ORDER BY SUM(e.amount) DESC
    `;

    const [revenueResult, cogsResult, creditResult, inventoryResult, expensesResult, expenseByCategoryResult] = await Promise.all([
      pool.query(revenueQuery, [startDate, endDate]),
      pool.query(cogsQuery, [startDate, endDate]),
      pool.query(creditQuery, [startDate, endDate]),
      pool.query(inventoryQuery),
      pool.query(expensesQuery, [startDate, endDate]),
      pool.query(expenseByCategoryQuery, [startDate, endDate]),
    ]);

    const revenue = revenueResult.rows[0];
    const cogs = cogsResult.rows[0];
    const credit = creditResult.rows[0];
    const inventory = inventoryResult.rows[0];
    const expenses = expensesResult.rows[0];
    const expensesByCategory = expenseByCategoryResult.rows;

    const grossRevenue = parseFloat(revenue.grossRevenue) || 0;
    const discounts = parseFloat(revenue.discounts) || 0;
    const netRevenue = parseFloat(revenue.netRevenue) || 0;
    const costOfGoodsSold = parseFloat(cogs.costOfGoodsSold) || 0;
    const grossProfit = netRevenue - costOfGoodsSold;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

    // Operating Expenses
    const totalOperatingExpenses = parseFloat(expenses.totalExpenses) || 0;

    // Net Profit = Gross Profit - Operating Expenses
    const netProfit = grossProfit - totalOperatingExpenses;
    const netProfitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

    return {
      period: { startDate, endDate },
      revenue: {
        grossRevenue,
        discounts,
        taxCollected: parseFloat(revenue.taxCollected) || 0,
        netRevenue,
        cashReceived: parseFloat(revenue.cashReceived) || 0,
        transactionCount: parseInt(revenue.transactionCount) || 0,
      },
      costOfGoodsSold,
      grossProfit,
      grossProfitMargin,
      // Operating Expenses Section
      operatingExpenses: {
        total: totalOperatingExpenses,
        count: parseInt(expenses.expenseCount) || 0,
        byCategory: expensesByCategory.map((row: any) => ({
          category: row.category,
          amount: parseFloat(row.amount) || 0,
          count: parseInt(row.count) || 0,
        })),
      },
      // Net Profit (after operating expenses)
      netProfit,
      netProfitMargin,
      accountsReceivable: parseFloat(credit.accountsReceivable) || 0,
      inventoryValue: parseFloat(inventory.inventoryValue) || 0,
    };
  },

  // ==========================================================================
  // CUSTOMER REPORTS
  // ==========================================================================

  /**
   * Customer Accounts Report - All customers with balances and activity
   */
  async getCustomerAccountsReport(filters?: { hasBalance?: boolean }) {
    let query = `
      SELECT 
        c.id as "customerId",
        c.name as "customerName",
        c.email,
        c.phone,
        c.balance,
        c.credit_limit as "creditLimit",
        ABS(c.balance) as "absoluteBalance",
        CASE WHEN c.balance < 0 THEN 'OWES' ELSE 'CREDIT' END as "balanceType",
        -- Total purchases
        (
          SELECT COALESCE(SUM(s.total_amount), 0)
          FROM sales s
          WHERE s.customer_id = c.id AND s.status = 'COMPLETED'
        ) as "totalPurchases",
        -- Total payments made
        (
          SELECT COALESCE(SUM(ip.amount), 0)
          FROM invoice_payments ip
          JOIN invoices i ON ip.invoice_id = i.id
          WHERE i.customer_id = c.id
        ) as "totalPayments",
        -- Outstanding invoices count
        (
          SELECT COUNT(*)
          FROM invoices i
          WHERE i.customer_id = c.id
            AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
        ) as "unpaidInvoiceCount",
        -- Outstanding amount from invoices (SSOT)
        (
          SELECT COALESCE(SUM(i.amount_due), 0)
          FROM invoices i
          WHERE i.customer_id = c.id
            AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
        ) as "outstandingAmount",
        -- Last activity date (last purchase)
        (
          SELECT MAX(s.sale_date)
          FROM sales s
          WHERE s.customer_id = c.id
        ) as "lastActivityDate",
        -- Transaction count
        (
          SELECT COUNT(*)
          FROM sales s
          WHERE s.customer_id = c.id AND s.status = 'COMPLETED'
        ) as "transactionCount"
      FROM customers c
      WHERE c.is_active = true
    `;

    if (filters?.hasBalance) {
      query += ` AND c.balance != 0`;
    }

    query += ` ORDER BY ABS(c.balance) DESC, c.name`;

    const result = await pool.query(query);
    return result.rows;
  },

  /**
   * Customer Aging Report - Outstanding invoices by age
   */
  async getCustomerAgingReport() {
    const query = `
      SELECT 
        c.id,
        c.name as "customerName",
        c.phone,
        c.email,
        c.balance,
        c.credit_limit as "creditLimit",
        -- Outstanding from invoices (SSOT)
        COALESCE(aging.total_outstanding, 0) as "totalOutstanding",
        COALESCE(aging.current_due, 0) as "current",
        COALESCE(aging.days_1_30, 0) as "days1to30",
        COALESCE(aging.days_31_60, 0) as "days31to60",
        COALESCE(aging.days_61_90, 0) as "days61to90",
        COALESCE(aging.over_90, 0) as "over90",
        aging.oldest_invoice_date as "oldestInvoiceDate",
        aging.invoice_count as "unpaidInvoiceCount"
      FROM customers c
      LEFT JOIN LATERAL (
        SELECT 
          SUM(i.amount_due) as total_outstanding,
          SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN i.amount_due ELSE 0 END) as current_due,
          SUM(CASE WHEN i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30 THEN i.amount_due ELSE 0 END) as days_1_30,
          SUM(CASE WHEN i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60 THEN i.amount_due ELSE 0 END) as days_31_60,
          SUM(CASE WHEN i.due_date < CURRENT_DATE - 60 AND i.due_date >= CURRENT_DATE - 90 THEN i.amount_due ELSE 0 END) as days_61_90,
          SUM(CASE WHEN i.due_date < CURRENT_DATE - 90 THEN i.amount_due ELSE 0 END) as over_90,
          MIN(i.issue_date) as oldest_invoice_date,
          COUNT(*) as invoice_count
        FROM invoices i
        WHERE i.customer_id = c.id
          AND i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
      ) aging ON true
      WHERE c.balance < 0  -- Negative = customer owes money
      ORDER BY aging.total_outstanding DESC NULLS LAST
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  // ==========================================================================
  // INVENTORY REPORTS
  // ==========================================================================

  /**
   * Stock Valuation Report - Current inventory value
   * @param costingMethod - FIFO, AVCO, or STANDARD (currently only cost price used)
   */
  async getStockValuationReport(costingMethod?: string) {
    // Note: costingMethod parameter is accepted for future expansion
    // Currently using cost_price from products table
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.quantity_on_hand as "quantityOnHand",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        (p.quantity_on_hand * p.cost_price) as "stockValueAtCost",
        (p.quantity_on_hand * p.selling_price) as "stockValueAtRetail",
        (p.quantity_on_hand * (p.selling_price - p.cost_price)) as "potentialProfit",
        CASE WHEN p.selling_price > 0 
          THEN ((p.selling_price - p.cost_price) / p.selling_price) * 100 
          ELSE 0 
        END as "marginPercent",
        -- Batch details
        (
          SELECT json_agg(json_build_object(
            'batchNumber', ib.batch_number,
            'quantity', ib.remaining_quantity,
            'costPrice', ib.cost_price,
            'expiryDate', ib.expiry_date,
            'value', ib.remaining_quantity * ib.cost_price
          ))
          FROM inventory_batches ib
          WHERE ib.product_id = p.id AND ib.status = 'ACTIVE'
        ) as "batches"
      FROM products p
      WHERE p.is_active = true AND p.quantity_on_hand > 0
      ORDER BY (p.quantity_on_hand * p.cost_price) DESC
    `;

    const result = await pool.query(query);
    
    // Calculate totals - use property names frontend expects
    const totals = result.rows.reduce((acc, row) => ({
      totalProducts: acc.totalProducts + 1,
      totalQuantity: acc.totalQuantity + parseFloat(row.quantityOnHand),
      totalValueAtCost: acc.totalValueAtCost + parseFloat(row.stockValueAtCost),
      totalValueAtRetail: acc.totalValueAtRetail + parseFloat(row.stockValueAtRetail),
      totalPotentialProfit: acc.totalPotentialProfit + parseFloat(row.potentialProfit),
    }), { totalProducts: 0, totalQuantity: 0, totalValueAtCost: 0, totalValueAtRetail: 0, totalPotentialProfit: 0 });

    // Transform items to match frontend expected field names
    const products = result.rows.map(row => ({
      productId: row.id,
      productName: row.productName,
      sku: row.sku,
      category: row.category,
      totalQuantity: row.quantityOnHand,
      avgCostPrice: row.costPrice,
      sellingPrice: row.sellingPrice,
      valueAtCost: row.stockValueAtCost,
      valueAtRetail: row.stockValueAtRetail,
      potentialProfit: row.potentialProfit,
      marginPercent: row.marginPercent,
      batches: row.batches,
    }));

    return {
      products,
      summary: totals,
    };
  },

  /**
   * Inventory Report - Full inventory status
   */
  async getInventoryReport(filters?: { 
    lowStock?: boolean; 
    outOfStock?: boolean;
    expiringSoon?: boolean;
    category?: string;
  }) {
    let query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.quantity_on_hand as "quantityOnHand",
        p.reorder_level as "reorderLevel",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        p.track_expiry as "trackExpiry",
        (p.quantity_on_hand * p.cost_price) as "inventoryValue",
        CASE 
          WHEN p.quantity_on_hand = 0 THEN 'OUT_OF_STOCK'
          WHEN p.quantity_on_hand <= p.reorder_level THEN 'LOW_STOCK'
          ELSE 'IN_STOCK'
        END as "stockStatus",
        -- Expiring batches
        (
          SELECT COUNT(*)
          FROM inventory_batches ib
          WHERE ib.product_id = p.id
            AND ib.status = 'ACTIVE'
            AND ib.expiry_date IS NOT NULL
            AND ib.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        ) as "expiringBatchCount",
        (
          SELECT MIN(ib.expiry_date)
          FROM inventory_batches ib
          WHERE ib.product_id = p.id 
            AND ib.status = 'ACTIVE'
            AND ib.expiry_date IS NOT NULL
        ) as "nearestExpiry",
        -- Last received
        (
          SELECT MAX(ib.received_date)
          FROM inventory_batches ib
          WHERE ib.product_id = p.id
        ) as "lastReceivedDate",
        -- Last sold
        (
          SELECT MAX(s.sale_date)
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.status = 'COMPLETED'
        ) as "lastSoldDate"
      FROM products p
      WHERE p.is_active = true
    `;

    if (filters?.lowStock) {
      query += ` AND p.quantity_on_hand <= p.reorder_level AND p.quantity_on_hand > 0`;
    }

    if (filters?.outOfStock) {
      query += ` AND p.quantity_on_hand = 0`;
    }

    if (filters?.expiringSoon) {
      query += ` AND EXISTS (
        SELECT 1 FROM inventory_batches ib
        WHERE ib.product_id = p.id
          AND ib.status = 'ACTIVE'
          AND ib.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      )`;
    }

    if (filters?.category) {
      query += ` AND p.category = $1`;
    }

    query += ` ORDER BY p.name`;

    const values = filters?.category ? [filters.category] : [];
    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Out of Stock Report - Products with zero inventory
   */
  async getOutOfStockReport() {
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.reorder_level as "reorderLevel",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        -- Last sale
        (
          SELECT MAX(s.sale_date)
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.status = 'COMPLETED'
        ) as "lastSoldDate",
        -- Last received
        (
          SELECT MAX(ib.received_date)
          FROM inventory_batches ib
          WHERE ib.product_id = p.id
        ) as "lastReceivedDate",
        -- Total quantity sold all time
        (
          SELECT COALESCE(SUM(si.quantity), 0)
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.status = 'COMPLETED'
        ) as "totalSoldAllTime",
        -- Days out of stock (estimate)
        CURRENT_DATE - (
          SELECT MAX(s.sale_date)::date
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.status = 'COMPLETED'
        ) as "daysOutOfStock"
      FROM products p
      WHERE p.is_active = true AND p.quantity_on_hand = 0
      ORDER BY "lastSoldDate" DESC NULLS LAST
    `;

    const result = await pool.query(query);
    return result.rows;
  },

  // ==========================================================================
  // BEST SELLING REPORTS
  // ==========================================================================

  /**
   * Best Selling Products Report
   */
  async getBestSellingReport(filters: {
    startDate: string;
    endDate: string;
    limit?: number;
    sortBy?: 'quantity' | 'revenue' | 'profit';
  }) {
    const sortColumn = {
      quantity: '"totalQuantitySold"',
      revenue: '"totalRevenue"',
      profit: '"totalProfit"',
    }[filters.sortBy || 'revenue'];

    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.selling_price as "currentPrice",
        SUM(si.quantity) as "totalQuantitySold",
        COUNT(DISTINCT si.sale_id) as "transactionCount",
        SUM(si.total_price) as "totalRevenue",
        SUM(si.profit) as "totalProfit",
        AVG(si.unit_price) as "avgSellingPrice",
        AVG(si.unit_cost) as "avgCost",
        CASE WHEN SUM(si.total_price) > 0 
          THEN (SUM(si.profit) / SUM(si.total_price)) * 100 
          ELSE 0 
        END as "profitMarginPercent"
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY p.id, p.sku, p.name, p.category, p.selling_price
      ORDER BY ${sortColumn} DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [
      filters.startDate,
      filters.endDate,
      filters.limit || 20,
    ]);
    return result.rows;
  },

  /**
   * Best Selling Categories Report
   */
  async getBestSellingCategoriesReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        COALESCE(p.category, 'Uncategorized') as "category",
        COUNT(DISTINCT p.id) as "productCount",
        SUM(si.quantity) as "totalQuantitySold",
        COUNT(DISTINCT si.sale_id) as "transactionCount",
        SUM(si.total_price) as "totalRevenue",
        SUM(si.profit) as "totalProfit",
        CASE WHEN SUM(si.total_price) > 0 
          THEN (SUM(si.profit) / SUM(si.total_price)) * 100 
          ELSE 0 
        END as "profitMarginPercent"
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY p.category
      ORDER BY "totalRevenue" DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  // ==========================================================================
  // INVOICE REPORTS
  // ==========================================================================

  /**
   * Invoices Report - All invoices with status
   */
  async getInvoicesReport(filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    customerId?: string;
  }) {
    let query = `
      SELECT 
        i.id,
        i.invoice_number as "invoiceNumber",
        i.issue_date as "issueDate",
        i.due_date as "dueDate",
        c.name as "customerName",
        c.phone as "customerPhone",
        i.subtotal,
        i.tax_amount as "taxAmount",
        i.discount_amount as "discountAmount",
        i.total_amount as "totalAmount",
        i.amount_paid as "amountPaid",
        i.amount_due as "amountDue",
        i.status,
        s.sale_number as "saleNumber",
        CASE 
          WHEN i.status = 'PAID' THEN 0
          WHEN i.due_date < CURRENT_DATE THEN CURRENT_DATE - i.due_date
          ELSE 0 
        END as "daysOverdue",
        i.notes,
        -- Payment history
        (
          SELECT json_agg(json_build_object(
            'receiptNumber', ip.receipt_number,
            'paymentDate', ip.payment_date,
            'amount', ip.amount,
            'paymentMethod', ip.payment_method,
            'reference', ip.reference_number
          ) ORDER BY ip.payment_date DESC)
          FROM invoice_payments ip
          WHERE ip.invoice_id = i.id
        ) as "payments"
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN sales s ON i.sale_id = s.id
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      query += ` AND DATE(i.issue_date) >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND DATE(i.issue_date) <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    if (filters.status) {
      query += ` AND i.status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.customerId) {
      query += ` AND i.customer_id = $${paramIndex++}`;
      values.push(filters.customerId);
    }

    query += ` ORDER BY i.issue_date DESC, i.invoice_number DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Invoice Summary - Aggregated invoice data
   */
  async getInvoiceSummary(filters: { startDate?: string; endDate?: string }) {
    let query = `
      SELECT 
        COUNT(*) as "totalInvoices",
        SUM(i.total_amount) as "totalInvoiced",
        SUM(i.amount_paid) as "totalPaid",
        SUM(i.amount_due) as "totalOutstanding",
        COUNT(CASE WHEN i.status = 'PAID' THEN 1 END) as "paidCount",
        COUNT(CASE WHEN i.status = 'PARTIALLY_PAID' THEN 1 END) as "partiallyPaidCount",
        COUNT(CASE WHEN i.status IN ('DRAFT', 'SENT') THEN 1 END) as "unpaidCount",
        COUNT(CASE WHEN i.status = 'OVERDUE' THEN 1 END) as "overdueCount",
        SUM(CASE WHEN i.status = 'OVERDUE' THEN i.amount_due ELSE 0 END) as "overdueAmount"
      FROM invoices i
      WHERE 1=1
    `;

    const values: any[] = [];
    let paramIndex = 1;

    if (filters.startDate) {
      query += ` AND DATE(i.issue_date) >= $${paramIndex++}`;
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ` AND DATE(i.issue_date) <= $${paramIndex++}`;
      values.push(filters.endDate);
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // ==========================================================================
  // VOIDED & REFUND REPORTS
  // ==========================================================================

  /**
   * Voided Sales Report
   */
  async getVoidedSalesReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        s.id,
        s.sale_number as "saleNumber",
        s.sale_date as "saleDate",
        c.name as "customerName",
        u.full_name as "cashierName",
        s.total_amount as "totalAmount",
        s.total_cost as "totalCost",
        s.profit as "lostProfit",
        s.payment_method as "paymentMethod",
        s.notes as "voidReason",
        s.created_at as "originalSaleDate",
        -- Items that were in the sale
        (
          SELECT json_agg(json_build_object(
            'productName', p.name,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'total', si.total_price
          ))
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = s.id
        ) as "items"
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'VOID'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      ORDER BY s.sale_date DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    
    // Calculate summary
    const summary = result.rows.reduce((acc, row) => ({
      totalVoided: acc.totalVoided + 1,
      totalVoidedAmount: acc.totalVoidedAmount + parseFloat(row.totalAmount || 0),
      totalLostProfit: acc.totalLostProfit + parseFloat(row.lostProfit || 0),
    }), { totalVoided: 0, totalVoidedAmount: 0, totalLostProfit: 0 });

    return {
      items: result.rows,
      summary,
    };
  },

  /**
   * Refund Report
   */
  async getRefundReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        s.id,
        s.sale_number as "saleNumber",
        s.sale_date as "saleDate",
        c.name as "customerName",
        u.full_name as "cashierName",
        s.total_amount as "originalAmount",
        s.total_cost as "originalCost",
        s.notes as "refundReason",
        -- Items that were refunded
        (
          SELECT json_agg(json_build_object(
            'productName', p.name,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'total', si.total_price
          ))
          FROM sale_items si
          JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = s.id
        ) as "items"
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'REFUNDED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      ORDER BY s.sale_date DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    
    // Calculate summary
    const summary = result.rows.reduce((acc, row) => ({
      totalRefunds: acc.totalRefunds + 1,
      totalRefundedAmount: acc.totalRefundedAmount + parseFloat(row.originalAmount || 0),
    }), { totalRefunds: 0, totalRefundedAmount: 0 });

    return {
      items: result.rows,
      summary,
    };
  },

  // ==========================================================================
  // DASHBOARD / QUICK REPORTS
  // ==========================================================================

  /**
   * Dashboard Summary - Quick overview stats
   */
  async getDashboardSummary() {
    const todayQuery = `
      SELECT 
        COUNT(*) as "todaySales",
        COALESCE(SUM(total_amount), 0) as "todayRevenue",
        COALESCE(SUM(profit), 0) as "todayProfit"
      FROM sales
      WHERE status = 'COMPLETED' AND DATE(sale_date) = CURRENT_DATE
    `;

    const monthQuery = `
      SELECT 
        COUNT(*) as "monthSales",
        COALESCE(SUM(total_amount), 0) as "monthRevenue",
        COALESCE(SUM(profit), 0) as "monthProfit"
      FROM sales
      WHERE status = 'COMPLETED' 
        AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE)
    `;

    const inventoryQuery = `
      SELECT 
        COUNT(*) as "totalProducts",
        COUNT(CASE WHEN quantity_on_hand = 0 THEN 1 END) as "outOfStock",
        COUNT(CASE WHEN quantity_on_hand > 0 AND quantity_on_hand <= reorder_level THEN 1 END) as "lowStock",
        COALESCE(SUM(quantity_on_hand * cost_price), 0) as "inventoryValue"
      FROM products
      WHERE is_active = true
    `;

    const receivablesQuery = `
      SELECT 
        COUNT(*) as "unpaidInvoices",
        COALESCE(SUM(amount_due), 0) as "totalReceivables"
      FROM invoices
      WHERE status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
    `;

    const [todayResult, monthResult, inventoryResult, receivablesResult] = await Promise.all([
      pool.query(todayQuery),
      pool.query(monthQuery),
      pool.query(inventoryQuery),
      pool.query(receivablesQuery),
    ]);

    return {
      today: todayResult.rows[0],
      month: monthResult.rows[0],
      inventory: inventoryResult.rows[0],
      receivables: receivablesResult.rows[0],
    };
  },

  // ==========================================================================
  // ADDITIONAL SALES REPORTS
  // ==========================================================================

  /**
   * Sales by Hour Report - Hourly breakdown for a date range
   */
  async getSalesByHourReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        EXTRACT(HOUR FROM s.sale_date) as "hour",
        COUNT(*) as "transactionCount",
        SUM(s.total_amount) as "totalSales",
        SUM(s.profit) as "totalProfit",
        AVG(s.total_amount) as "avgTransactionValue"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY EXTRACT(HOUR FROM s.sale_date)
      ORDER BY "hour"
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Sales by Cashier Report - Performance by user
   */
  async getSalesByCashierReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        u.id as "cashierId",
        u.full_name as "cashierName",
        COUNT(*) as "transactionCount",
        SUM(s.total_amount) as "totalSales",
        SUM(s.profit) as "totalProfit",
        AVG(s.total_amount) as "avgTransactionValue",
        AVG(s.profit_margin) * 100 as "avgProfitMargin",
        SUM(CASE WHEN s.payment_method = 'CASH' THEN s.amount_paid ELSE 0 END) as "cashCollected",
        SUM(CASE WHEN s.payment_method = 'CARD' THEN s.amount_paid ELSE 0 END) as "cardCollected",
        SUM(CASE WHEN s.payment_method = 'MOBILE_MONEY' THEN s.amount_paid ELSE 0 END) as "mobileMoneyCollected",
        COUNT(CASE WHEN s.payment_method = 'CREDIT' THEN 1 END) as "creditSalesCount",
        MIN(s.sale_date) as "firstSale",
        MAX(s.sale_date) as "lastSale"
      FROM sales s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY u.id, u.full_name
      ORDER BY "totalSales" DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Sales Trends Report - Daily comparison with previous period
   */
  async getSalesTrendsReport(filters: { startDate: string; endDate: string }) {
    const query = `
      WITH current_period AS (
        SELECT 
          DATE(s.sale_date) as "date",
          COUNT(*) as "transactionCount",
          SUM(s.total_amount) as "totalSales",
          SUM(s.profit) as "totalProfit"
        FROM sales s
        WHERE s.status = 'COMPLETED'
          AND DATE(s.sale_date) >= $1
          AND DATE(s.sale_date) <= $2
        GROUP BY DATE(s.sale_date)
      ),
      running_totals AS (
        SELECT 
          "date",
          "transactionCount",
          "totalSales",
          "totalProfit",
          SUM("totalSales") OVER (ORDER BY "date") as "cumulativeSales",
          SUM("totalProfit") OVER (ORDER BY "date") as "cumulativeProfit",
          LAG("totalSales") OVER (ORDER BY "date") as "previousDaySales",
          AVG("totalSales") OVER (ORDER BY "date" ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as "movingAvg7Day"
        FROM current_period
      )
      SELECT 
        "date",
        "transactionCount",
        "totalSales",
        "totalProfit",
        "cumulativeSales",
        "cumulativeProfit",
        "previousDaySales",
        "movingAvg7Day",
        CASE WHEN "previousDaySales" > 0 
          THEN (("totalSales" - "previousDaySales") / "previousDaySales") * 100 
          ELSE 0 
        END as "dailyGrowthPercent"
      FROM running_totals
      ORDER BY "date"
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Payment Method Analysis Report
   */
  async getPaymentMethodAnalysisReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        s.payment_method as "paymentMethod",
        COUNT(*) as "transactionCount",
        SUM(s.total_amount) as "totalSales",
        SUM(s.amount_paid) as "totalCollected",
        SUM(s.profit) as "totalProfit",
        AVG(s.total_amount) as "avgTransactionValue",
        MIN(s.total_amount) as "minTransaction",
        MAX(s.total_amount) as "maxTransaction",
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER ()), 2) as "percentOfTransactions",
        ROUND((SUM(s.total_amount) * 100.0 / SUM(SUM(s.total_amount)) OVER ()), 2) as "percentOfSales"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
      GROUP BY s.payment_method
      ORDER BY "totalSales" DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  // ==========================================================================
  // ADDITIONAL INVENTORY REPORTS
  // ==========================================================================

  /**
   * Inventory Movement History Report
   */
  async getInventoryMovementReport(filters: { 
    startDate: string; 
    endDate: string;
    productId?: string;
    movementType?: string;
  }) {
    let query = `
      SELECT 
        sm.id,
        sm.movement_number as "movementNumber",
        sm.created_at as "movementDate",
        p.name as "productName",
        p.sku,
        sm.quantity,
        sm.movement_type as "movementType",
        sm.reference_type as "referenceType",
        sm.reference_id as "referenceId",
        sm.unit_cost as "unitCost",
        (sm.quantity * COALESCE(sm.unit_cost, p.cost_price)) as "totalValue",
        ib.batch_number as "batchNumber",
        ib.expiry_date as "expiryDate",
        sm.notes,
        u.full_name as "createdBy"
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN inventory_batches ib ON sm.batch_id = ib.id
      LEFT JOIN users u ON sm.created_by_id = u.id
      WHERE DATE(sm.created_at) >= $1
        AND DATE(sm.created_at) <= $2
    `;

    const values: any[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.productId) {
      query += ` AND sm.product_id = $${paramIndex++}`;
      values.push(filters.productId);
    }

    if (filters.movementType) {
      query += ` AND sm.movement_type = $${paramIndex++}`;
      values.push(filters.movementType);
    }

    query += ` ORDER BY sm.created_at DESC`;

    const result = await pool.query(query, values);
    
    // Calculate summary
    const summary = result.rows.reduce((acc, row) => {
      const qty = parseFloat(row.quantity);
      if (qty > 0) {
        acc.totalIn += qty;
        acc.totalInValue += parseFloat(row.totalValue || 0);
      } else {
        acc.totalOut += Math.abs(qty);
        acc.totalOutValue += Math.abs(parseFloat(row.totalValue || 0));
      }
      return acc;
    }, { totalIn: 0, totalOut: 0, totalInValue: 0, totalOutValue: 0 });

    return {
      items: result.rows,
      summary,
    };
  },

  /**
   * Slow Moving Products Report
   */
  async getSlowMovingProductsReport(filters: { days?: number }) {
    const days = filters.days || 30;
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.quantity_on_hand as "quantityOnHand",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        (p.quantity_on_hand * p.cost_price) as "inventoryValue",
        COALESCE(sales_data.total_sold, 0) as "totalSoldInPeriod",
        COALESCE(sales_data.last_sale_date, p.created_at) as "lastSaleDate",
        CURRENT_DATE - COALESCE(sales_data.last_sale_date::date, p.created_at::date) as "daysSinceLastSale",
        CASE 
          WHEN p.quantity_on_hand > 0 AND COALESCE(sales_data.avg_daily_sales, 0) > 0 
          THEN p.quantity_on_hand / sales_data.avg_daily_sales
          ELSE NULL 
        END as "daysOfStockRemaining"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT 
          SUM(si.quantity) as total_sold,
          MAX(s.sale_date) as last_sale_date,
          SUM(si.quantity) / NULLIF($1::numeric, 0) as avg_daily_sales
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = p.id
          AND s.status = 'COMPLETED'
          AND s.sale_date >= CURRENT_DATE - $1::int * INTERVAL '1 day'
      ) sales_data ON true
      WHERE p.is_active = true
        AND p.quantity_on_hand > 0
        AND (sales_data.total_sold IS NULL OR sales_data.total_sold < p.quantity_on_hand * 0.1)
      ORDER BY "daysSinceLastSale" DESC NULLS FIRST, "inventoryValue" DESC
    `;

    const result = await pool.query(query, [days]);
    return result.rows;
  },

  /**
   * Fast Moving Products Report (High Turnover)
   */
  async getFastMovingProductsReport(filters: { startDate: string; endDate: string; limit?: number }) {
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.quantity_on_hand as "currentStock",
        p.reorder_level as "reorderLevel",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        sales_data.total_sold as "totalSold",
        sales_data.total_revenue as "totalRevenue",
        sales_data.total_profit as "totalProfit",
        sales_data.transaction_count as "transactionCount",
        sales_data.avg_daily_sales as "avgDailySales",
        CASE 
          WHEN sales_data.avg_daily_sales > 0 
          THEN p.quantity_on_hand / sales_data.avg_daily_sales
          ELSE NULL 
        END as "daysOfStockRemaining",
        CASE 
          WHEN p.quantity_on_hand <= p.reorder_level THEN 'REORDER_NOW'
          WHEN sales_data.avg_daily_sales > 0 AND p.quantity_on_hand / sales_data.avg_daily_sales < 7 THEN 'REORDER_SOON'
          ELSE 'OK'
        END as "stockAlert"
      FROM products p
      JOIN LATERAL (
        SELECT 
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          SUM(si.profit) as total_profit,
          COUNT(DISTINCT si.sale_id) as transaction_count,
          SUM(si.quantity) / NULLIF(DATE($2) - DATE($1) + 1, 0)::numeric as avg_daily_sales
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = p.id
          AND s.status = 'COMPLETED'
          AND DATE(s.sale_date) >= $1
          AND DATE(s.sale_date) <= $2
      ) sales_data ON sales_data.total_sold > 0
      WHERE p.is_active = true
      ORDER BY sales_data.total_sold DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate, filters.limit || 20]);
    return result.rows;
  },

  /**
   * Expiring Stock Report
   */
  async getExpiringStockReport(filters: { days?: number }) {
    const days = filters.days || 30;
    const query = `
      SELECT 
        p.id as "productId",
        p.sku,
        p.name as "productName",
        p.category,
        ib.id as "batchId",
        ib.batch_number as "batchNumber",
        ib.remaining_quantity as "quantity",
        ib.cost_price as "costPrice",
        (ib.remaining_quantity * ib.cost_price) as "value",
        ib.expiry_date as "expiryDate",
        ib.expiry_date - CURRENT_DATE as "daysUntilExpiry",
        CASE 
          WHEN ib.expiry_date < CURRENT_DATE THEN 'EXPIRED'
          WHEN ib.expiry_date <= CURRENT_DATE + 7 THEN 'CRITICAL'
          WHEN ib.expiry_date <= CURRENT_DATE + 14 THEN 'WARNING'
          ELSE 'APPROACHING'
        END as "urgency"
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      WHERE ib.status = 'ACTIVE'
        AND ib.remaining_quantity > 0
        AND ib.expiry_date IS NOT NULL
        AND ib.expiry_date <= CURRENT_DATE + $1::int * INTERVAL '1 day'
      ORDER BY ib.expiry_date, "value" DESC
    `;

    const result = await pool.query(query, [days]);
    
    // Calculate summary
    const summary = {
      totalItems: result.rows.length,
      totalQuantity: result.rows.reduce((sum, r) => sum + parseFloat(r.quantity), 0),
      totalValue: result.rows.reduce((sum, r) => sum + parseFloat(r.value), 0),
      expiredCount: result.rows.filter(r => r.urgency === 'EXPIRED').length,
      criticalCount: result.rows.filter(r => r.urgency === 'CRITICAL').length,
      warningCount: result.rows.filter(r => r.urgency === 'WARNING').length,
    };

    return {
      items: result.rows,
      summary,
    };
  },

  /**
   * Stock Reorder Report
   */
  async getStockReorderReport() {
    const query = `
      SELECT 
        p.id,
        p.sku,
        p.name as "productName",
        p.category,
        p.quantity_on_hand as "currentStock",
        p.reorder_level as "reorderLevel",
        p.cost_price as "costPrice",
        p.selling_price as "sellingPrice",
        (p.reorder_level - p.quantity_on_hand) as "shortfall",
        (p.reorder_level * 2 - p.quantity_on_hand) as "suggestedOrderQty",
        ((p.reorder_level * 2 - p.quantity_on_hand) * p.cost_price) as "estimatedCost",
        -- Recent sales velocity
        COALESCE(sales_30.total_sold, 0) as "soldLast30Days",
        COALESCE(sales_30.total_sold / 30.0, 0) as "avgDailySales",
        CASE 
          WHEN p.quantity_on_hand = 0 THEN 'OUT_OF_STOCK'
          WHEN p.quantity_on_hand <= p.reorder_level * 0.5 THEN 'CRITICAL'
          ELSE 'LOW'
        END as "urgency",
        -- Last received
        (
          SELECT MAX(ib.received_date)
          FROM inventory_batches ib
          WHERE ib.product_id = p.id
        ) as "lastReceivedDate"
      FROM products p
      LEFT JOIN LATERAL (
        SELECT SUM(si.quantity) as total_sold
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = p.id
          AND s.status = 'COMPLETED'
          AND s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
      ) sales_30 ON true
      WHERE p.is_active = true
        AND p.quantity_on_hand <= p.reorder_level
      ORDER BY 
        CASE WHEN p.quantity_on_hand = 0 THEN 0 ELSE 1 END,
        "shortfall" DESC
    `;

    const result = await pool.query(query);
    
    // Calculate summary
    const summary = {
      totalProducts: result.rows.length,
      outOfStockCount: result.rows.filter(r => r.urgency === 'OUT_OF_STOCK').length,
      criticalCount: result.rows.filter(r => r.urgency === 'CRITICAL').length,
      totalEstimatedCost: result.rows.reduce((sum, r) => sum + parseFloat(r.estimatedCost || 0), 0),
    };

    return {
      items: result.rows,
      summary,
    };
  },

  /**
   * Inventory Turnover Report
   */
  async getInventoryTurnoverReport(filters: { startDate: string; endDate: string }) {
    const query = `
      WITH period_data AS (
        SELECT 
          p.id,
          p.sku,
          p.name,
          p.category,
          p.quantity_on_hand as current_stock,
          p.cost_price,
          (p.quantity_on_hand * p.cost_price) as current_value,
          -- Sales in period
          COALESCE(SUM(si.quantity), 0) as units_sold,
          COALESCE(SUM(si.quantity * si.unit_cost), 0) as cogs_sold
        FROM products p
        LEFT JOIN sale_items si ON p.id = si.product_id
        LEFT JOIN sales s ON si.sale_id = s.id 
          AND s.status = 'COMPLETED'
          AND DATE(s.sale_date) >= $1
          AND DATE(s.sale_date) <= $2
        WHERE p.is_active = true
        GROUP BY p.id, p.sku, p.name, p.category, p.quantity_on_hand, p.cost_price
      )
      SELECT 
        id,
        sku,
        name as "productName",
        category,
        current_stock as "currentStock",
        cost_price as "costPrice",
        current_value as "currentInventoryValue",
        units_sold as "unitsSold",
        cogs_sold as "costOfGoodsSold",
        -- Turnover calculation: COGS / Average Inventory
        CASE 
          WHEN current_value > 0 THEN cogs_sold / current_value
          ELSE 0 
        END as "turnoverRatio",
        -- Days to sell current inventory at current rate
        CASE 
          WHEN units_sold > 0 THEN current_stock / (units_sold / (DATE($2) - DATE($1) + 1)::numeric)
          ELSE NULL 
        END as "daysOfSupply"
      FROM period_data
      WHERE units_sold > 0 OR current_stock > 0
      ORDER BY "turnoverRatio" DESC NULLS LAST
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    
    // Calculate overall summary
    const summary = {
      totalProducts: result.rows.length,
      totalCurrentValue: result.rows.reduce((sum, r) => sum + parseFloat(r.currentInventoryValue || 0), 0),
      totalCOGS: result.rows.reduce((sum, r) => sum + parseFloat(r.costOfGoodsSold || 0), 0),
      avgTurnoverRatio: result.rows.length > 0 
        ? result.rows.reduce((sum, r) => sum + parseFloat(r.turnoverRatio || 0), 0) / result.rows.length 
        : 0,
    };

    return {
      items: result.rows,
      summary,
    };
  },

  // ==========================================================================
  // LEGACY FUNCTIONS (for backward compatibility)
  // ==========================================================================

  /**
   * Product Performance Report
   */
  async getProductPerformanceReport(filters: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    return this.getBestSellingReport({
      startDate: filters.startDate || '2000-01-01',
      endDate: filters.endDate || '2100-12-31',
      limit: filters.limit,
      sortBy: 'revenue',
    });
  },

  /**
   * Daily Sales Summary
   */
  async getDailySalesSummary(date: string) {
    const result = await this.getDailySalesReport({ startDate: date, endDate: date });
    return result[0] || null;
  },

  /**
   * Legacy Sales Report
   */
  async getSalesReport(filters: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    paymentMethod?: string;
  }) {
    return this.getDailySalesReport({
      startDate: filters.startDate || '2000-01-01',
      endDate: filters.endDate || '2100-12-31',
    });
  },

  /**
   * Discount Report - Shows all sales with discounts, who gave them
   */
  async getDiscountReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        s.id as "saleId",
        s.sale_number as "saleNumber",
        s.sale_date as "saleDate",
        s.subtotal,
        s.discount_amount as "discountAmount",
        s.total_amount as "totalAmount",
        ROUND((s.discount_amount / NULLIF(s.subtotal, 0)) * 100, 2) as "discountPercent",
        s.notes as "saleNotes",
        c.name as "customerName",
        u.full_name as "cashierName",
        u.id as "cashierId",
        (
          SELECT json_agg(json_build_object(
            'productName', p.name,
            'quantity', si.quantity,
            'unitPrice', si.unit_price,
            'discountAmount', si.discount_amount,
            'totalPrice', si.total_price
          ))
          FROM sale_items si
          JOIN products p ON p.id = si.product_id
          WHERE si.sale_id = s.id AND si.discount_amount > 0
        ) as "discountedItems"
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN users u ON u.id = s.cashier_id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
        AND s.discount_amount > 0
      ORDER BY s.sale_date DESC, s.discount_amount DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Discount Summary by Cashier - Aggregated discount data by employee
   */
  async getDiscountSummaryByCashier(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        u.id as "cashierId",
        u.full_name as "cashierName",
        COUNT(*) as "salesWithDiscount",
        SUM(s.discount_amount) as "totalDiscountGiven",
        SUM(s.subtotal) as "totalSubtotal",
        ROUND(AVG((s.discount_amount / NULLIF(s.subtotal, 0)) * 100), 2) as "avgDiscountPercent",
        MAX(s.discount_amount) as "maxDiscountAmount",
        MIN(s.discount_amount) as "minDiscountAmount"
      FROM sales s
      JOIN users u ON u.id = s.cashier_id
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
        AND s.discount_amount > 0
      GROUP BY u.id, u.full_name
      ORDER BY SUM(s.discount_amount) DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  // ==========================================================================
  // INCOME / PAYMENTS RECEIVED REPORTS
  // ==========================================================================

  /**
   * Payments Received Report - All payments collected from customers
   * Shows income from customer debt payments (invoice payments)
   */
  async getPaymentsReceivedReport(filters: { startDate: string; endDate: string; customerId?: string; paymentMethod?: string }) {
    let query = `
      SELECT 
        ip.id,
        ip.receipt_number as "receiptNumber",
        ip.payment_date as "paymentDate",
        ip.amount,
        ip.payment_method as "paymentMethod",
        ip.reference_number as "referenceNumber",
        ip.notes,
        i.invoice_number as "invoiceNumber",
        i.total_amount as "invoiceTotal",
        i.amount_due as "invoiceBalance",
        c.id as "customerId",
        c.name as "customerName",
        c.phone as "customerPhone",
        u.full_name as "receivedBy",
        ip.created_at as "createdAt"
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN users u ON ip.processed_by_id = u.id
      WHERE DATE(ip.payment_date) >= $1
        AND DATE(ip.payment_date) <= $2
    `;

    const values: any[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.customerId) {
      query += ` AND c.id = $${paramIndex++}`;
      values.push(filters.customerId);
    }

    if (filters.paymentMethod) {
      query += ` AND ip.payment_method = $${paramIndex++}`;
      values.push(filters.paymentMethod);
    }

    query += ` ORDER BY ip.payment_date DESC, ip.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Payments Received Summary - Aggregated payment data
   */
  async getPaymentsReceivedSummary(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        COUNT(*) as "totalPayments",
        SUM(ip.amount) as "totalAmountCollected",
        COUNT(DISTINCT i.customer_id) as "uniqueCustomers",
        SUM(CASE WHEN ip.payment_method = 'CASH' THEN ip.amount ELSE 0 END) as "cashCollected",
        SUM(CASE WHEN ip.payment_method = 'CARD' THEN ip.amount ELSE 0 END) as "cardCollected",
        SUM(CASE WHEN ip.payment_method = 'MOBILE_MONEY' THEN ip.amount ELSE 0 END) as "mobileMoneyCollected",
        SUM(CASE WHEN ip.payment_method = 'BANK_TRANSFER' THEN ip.amount ELSE 0 END) as "bankTransferCollected",
        COUNT(CASE WHEN ip.payment_method = 'CASH' THEN 1 END) as "cashPaymentCount",
        COUNT(CASE WHEN ip.payment_method = 'CARD' THEN 1 END) as "cardPaymentCount",
        COUNT(CASE WHEN ip.payment_method = 'MOBILE_MONEY' THEN 1 END) as "mobileMoneyPaymentCount",
        COUNT(CASE WHEN ip.payment_method = 'BANK_TRANSFER' THEN 1 END) as "bankTransferPaymentCount",
        AVG(ip.amount) as "avgPaymentAmount",
        MAX(ip.amount) as "largestPayment",
        MIN(ip.amount) as "smallestPayment"
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      WHERE DATE(ip.payment_date) >= $1
        AND DATE(ip.payment_date) <= $2
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows[0];
  },

  /**
   * Daily Collections Report - Payments grouped by date
   */
  async getDailyCollectionsReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        DATE(ip.payment_date) as "date",
        COUNT(*) as "paymentCount",
        SUM(ip.amount) as "totalCollected",
        SUM(CASE WHEN ip.payment_method = 'CASH' THEN ip.amount ELSE 0 END) as "cashCollected",
        SUM(CASE WHEN ip.payment_method = 'CARD' THEN ip.amount ELSE 0 END) as "cardCollected",
        SUM(CASE WHEN ip.payment_method = 'MOBILE_MONEY' THEN ip.amount ELSE 0 END) as "mobileMoneyCollected",
        SUM(CASE WHEN ip.payment_method = 'BANK_TRANSFER' THEN ip.amount ELSE 0 END) as "bankTransferCollected",
        COUNT(DISTINCT i.customer_id) as "uniqueCustomers"
      FROM invoice_payments ip
      JOIN invoices i ON ip.invoice_id = i.id
      WHERE DATE(ip.payment_date) >= $1
        AND DATE(ip.payment_date) <= $2
      GROUP BY DATE(ip.payment_date)
      ORDER BY DATE(ip.payment_date) DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  // ==========================================================================
  // EXPENSE REPORTS
  // ==========================================================================

  /**
   * Expense Report - All expenses with details
   */
  async getExpenseReport(filters: { startDate: string; endDate: string; category?: string; paymentMethod?: string }) {
    let query = `
      SELECT 
        e.id,
        e.expense_number as "expenseNumber",
        e.expense_date as "expenseDate",
        e.category,
        e.description,
        e.amount,
        e.payment_method as "paymentMethod",
        e.vendor_name as "vendorName",
        e.reference_number as "referenceNumber",
        e.notes,
        u.full_name as "createdBy",
        e.created_at as "createdAt"
      FROM expenses e
      LEFT JOIN users u ON e.created_by_id = u.id
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
    `;

    const values: any[] = [filters.startDate, filters.endDate];
    let paramIndex = 3;

    if (filters.category) {
      query += ` AND e.category = $${paramIndex++}`;
      values.push(filters.category);
    }

    if (filters.paymentMethod) {
      query += ` AND e.payment_method = $${paramIndex++}`;
      values.push(filters.paymentMethod);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  /**
   * Expense Summary - Aggregated expense data
   */
  async getExpenseSummary(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        COUNT(*) as "totalExpenses",
        SUM(e.amount) as "totalAmount",
        AVG(e.amount) as "avgExpenseAmount",
        MAX(e.amount) as "largestExpense",
        MIN(e.amount) as "smallestExpense",
        SUM(CASE WHEN e.payment_method = 'CASH' THEN e.amount ELSE 0 END) as "cashExpenses",
        SUM(CASE WHEN e.payment_method = 'CARD' THEN e.amount ELSE 0 END) as "cardExpenses",
        SUM(CASE WHEN e.payment_method = 'MOBILE_MONEY' THEN e.amount ELSE 0 END) as "mobileMoneyExpenses",
        SUM(CASE WHEN e.payment_method = 'BANK_TRANSFER' THEN e.amount ELSE 0 END) as "bankTransferExpenses"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows[0];
  },

  /**
   * Expense by Category Report - Expenses grouped by category
   */
  async getExpenseByCategoryReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        e.category,
        COUNT(*) as "expenseCount",
        SUM(e.amount) as "totalAmount",
        AVG(e.amount) as "avgAmount",
        MIN(e.expense_date) as "firstExpenseDate",
        MAX(e.expense_date) as "lastExpenseDate"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
      GROUP BY e.category
      ORDER BY SUM(e.amount) DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  /**
   * Daily Expense Report - Expenses grouped by date
   */
  async getDailyExpenseReport(filters: { startDate: string; endDate: string }) {
    const query = `
      SELECT 
        DATE(e.expense_date) as "date",
        COUNT(*) as "expenseCount",
        SUM(e.amount) as "totalAmount",
        STRING_AGG(DISTINCT e.category, ', ') as "categories"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
      GROUP BY DATE(e.expense_date)
      ORDER BY DATE(e.expense_date) DESC
    `;

    const result = await pool.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  },

  // ==========================================================================
  // INCOME VS EXPENSE (PROFIT/LOSS) REPORT
  // ==========================================================================

  /**
   * Income vs Expense Report - Combined view of income and expenses
   * Returns summary totals and breakdown by category
   */
  async getIncomeVsExpenseReport(filters: { startDate: string; endDate: string }) {
    // Income from sales (cash + credit sales)
    const salesIncomeQuery = `
      SELECT 
        COALESCE(SUM(s.total_amount), 0) as "salesRevenue",
        COALESCE(SUM(s.profit), 0) as "grossProfit",
        COUNT(*) as "salesCount"
      FROM sales s
      WHERE s.status = 'COMPLETED'
        AND DATE(s.sale_date) >= $1
        AND DATE(s.sale_date) <= $2
    `;

    // Income from invoice payments (debt collections)
    const paymentsReceivedQuery = `
      SELECT 
        COALESCE(SUM(ip.amount), 0) as "paymentsReceived",
        COUNT(*) as "paymentCount"
      FROM invoice_payments ip
      WHERE DATE(ip.payment_date) >= $1
        AND DATE(ip.payment_date) <= $2
    `;

    // Total expenses
    const expensesQuery = `
      SELECT 
        COALESCE(SUM(e.amount), 0) as "totalExpenses",
        COUNT(*) as "expenseCount"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
    `;

    // Expenses by category
    const expensesByCategoryQuery = `
      SELECT 
        e.category,
        COALESCE(SUM(e.amount), 0) as "totalAmount",
        COUNT(*) as "count"
      FROM expenses e
      WHERE DATE(e.expense_date) >= $1
        AND DATE(e.expense_date) <= $2
      GROUP BY e.category
      ORDER BY SUM(e.amount) DESC
    `;

    // Daily breakdown
    const dailyQuery = `
      WITH daily_sales AS (
        SELECT 
          DATE(s.sale_date) as date,
          SUM(s.total_amount) as sales_income,
          SUM(s.profit) as gross_profit
        FROM sales s
        WHERE s.status = 'COMPLETED'
          AND DATE(s.sale_date) >= $1
          AND DATE(s.sale_date) <= $2
        GROUP BY DATE(s.sale_date)
      ),
      daily_collections AS (
        SELECT 
          DATE(ip.payment_date) as date,
          SUM(ip.amount) as collections_income
        FROM invoice_payments ip
        WHERE DATE(ip.payment_date) >= $1
          AND DATE(ip.payment_date) <= $2
        GROUP BY DATE(ip.payment_date)
      ),
      daily_expenses AS (
        SELECT 
          DATE(e.expense_date) as date,
          SUM(e.amount) as total_expenses
        FROM expenses e
        WHERE DATE(e.expense_date) >= $1
          AND DATE(e.expense_date) <= $2
        GROUP BY DATE(e.expense_date)
      ),
      all_dates AS (
        SELECT DISTINCT date FROM daily_sales
        UNION
        SELECT DISTINCT date FROM daily_collections
        UNION
        SELECT DISTINCT date FROM daily_expenses
      )
      SELECT 
        d.date,
        COALESCE(ds.sales_income, 0) as "salesIncome",
        COALESCE(ds.gross_profit, 0) as "grossProfit",
        COALESCE(dc.collections_income, 0) as "collectionsIncome",
        COALESCE(de.total_expenses, 0) as "totalExpenses",
        COALESCE(ds.gross_profit, 0) - COALESCE(de.total_expenses, 0) as "netProfit"
      FROM all_dates d
      LEFT JOIN daily_sales ds ON d.date = ds.date
      LEFT JOIN daily_collections dc ON d.date = dc.date
      LEFT JOIN daily_expenses de ON d.date = de.date
      ORDER BY d.date DESC
    `;

    const [salesResult, paymentsResult, expensesResult, expensesByCategoryResult, dailyResult] = await Promise.all([
      pool.query(salesIncomeQuery, [filters.startDate, filters.endDate]),
      pool.query(paymentsReceivedQuery, [filters.startDate, filters.endDate]),
      pool.query(expensesQuery, [filters.startDate, filters.endDate]),
      pool.query(expensesByCategoryQuery, [filters.startDate, filters.endDate]),
      pool.query(dailyQuery, [filters.startDate, filters.endDate]),
    ]);

    const salesData = salesResult.rows[0];
    const paymentsData = paymentsResult.rows[0];
    const expensesData = expensesResult.rows[0];
    const expensesByCategory = expensesByCategoryResult.rows;
    const dailyData = dailyResult.rows;

    const salesRevenue = parseFloat(salesData.salesRevenue) || 0;
    const grossProfit = parseFloat(salesData.grossProfit) || 0;
    const paymentsReceived = parseFloat(paymentsData.paymentsReceived) || 0;
    const totalExpenses = parseFloat(expensesData.totalExpenses) || 0;

    // Net Income = Gross Profit from Sales - Operating Expenses
    // (Gross Profit already accounts for COGS)
    const netIncome = grossProfit - totalExpenses;

    // Calculate percentage breakdown for each expense category
    const categoryBreakdown = expensesByCategory.map((cat: any) => ({
      category: cat.category,
      totalAmount: parseFloat(cat.totalAmount) || 0,
      count: parseInt(cat.count) || 0,
      percentage: totalExpenses > 0 ? ((parseFloat(cat.totalAmount) || 0) / totalExpenses) * 100 : 0,
    }));

    return {
      period: { startDate: filters.startDate, endDate: filters.endDate },
      income: {
        salesRevenue,
        grossProfit,
        paymentsReceived,
        salesCount: parseInt(salesData.salesCount) || 0,
        paymentCount: parseInt(paymentsData.paymentCount) || 0,
        totalIncome: salesRevenue + paymentsReceived,
      },
      expenses: {
        totalExpenses,
        expenseCount: parseInt(expensesData.expenseCount) || 0,
        byCategory: categoryBreakdown,
      },
      netIncome,
      netProfitMargin: salesRevenue > 0 ? (netIncome / salesRevenue) * 100 : 0,
      dailyBreakdown: dailyData.map((row: any) => ({
        date: row.date,
        salesIncome: parseFloat(row.salesIncome) || 0,
        grossProfit: parseFloat(row.grossProfit) || 0,
        collectionsIncome: parseFloat(row.collectionsIncome) || 0,
        totalExpenses: parseFloat(row.totalExpenses) || 0,
        netProfit: parseFloat(row.netProfit) || 0,
      })),
    };
  },
};
