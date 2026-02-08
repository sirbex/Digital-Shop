/**
 * usePermissions hook
 * 
 * Convenience wrapper around AuthContext for permission checks.
 * 
 * Permission keys follow the pattern: module.action
 * 
 * Modules & keys (75 total):
 *   sales:        read, create, void, refund, export, viewProfit
 *   products:     read, create, update, delete, viewCost, import, export
 *   inventory:    read, batches, movements, adjust, approve, valuation
 *   customers:    read, create, update, delete, viewBalance
 *   suppliers:    read, create, update, delete
 *   purchases:    read, create, update, approve, delete, receive, viewGR
 *   invoices:     read, create, payment
 *   expenses:     read, create, update, delete, approve
 *   reports:      sales, inventory, financial, customers, expenses, discounts, invoices, export
 *   users:        read, create, update, delete
 *   settings:     read, update, roles, reset
 *   pos:          access, hold, discount, cartDiscount, priceOverride, creditSale
 *   discounts:    view, apply, unlimited
 *   cashregister: open, close, movement, view
 */

import { useAuth } from '../contexts/AuthContext';

export function usePermissions() {
  const { permissions, hasPermission, hasAllPermissions, hasAnyPermission, user } = useAuth();

  return {
    /** Raw permission key array */
    permissions,
    /** Current user role */
    role: user?.role ?? null,
    /** Check single permission */
    can: hasPermission,
    /** Check ALL permissions */
    canAll: hasAllPermissions,
    /** Check ANY permission */
    canAny: hasAnyPermission,

    // ---- Module-level convenience shortcuts ----

    // Products
    canViewProducts: hasPermission('products.read'),
    canCreateProduct: hasPermission('products.create'),
    canEditProduct: hasPermission('products.update'),
    canDeleteProduct: hasPermission('products.delete'),
    canViewCostPrice: hasPermission('products.viewCost'),
    canImportProducts: hasPermission('products.import'),
    canExportProducts: hasPermission('products.export'),

    // Inventory (granular per sub-page)
    canViewInventory: hasPermission('inventory.read'),
    canViewBatches: hasPermission('inventory.batches'),
    canViewMovements: hasPermission('inventory.movements'),
    canAdjustStock: hasPermission('inventory.adjust'),
    canApproveAdjustment: hasPermission('inventory.approve'),
    canViewValuation: hasPermission('inventory.valuation'),

    // Purchases & Goods Receipts
    canViewPurchases: hasPermission('purchases.read'),
    canCreatePurchase: hasPermission('purchases.create'),
    canEditPurchase: hasPermission('purchases.update'),
    canApprovePurchase: hasPermission('purchases.approve'),
    canDeletePurchase: hasPermission('purchases.delete'),
    canReceiveGoods: hasPermission('purchases.receive'),
    canViewGoodsReceipts: hasPermission('purchases.viewGR'),

    // Sales
    canViewSales: hasPermission('sales.read'),
    canCreateSale: hasPermission('sales.create'),
    canVoidSale: hasPermission('sales.void'),
    canRefundSale: hasPermission('sales.refund'),
    canExportSales: hasPermission('sales.export'),
    canViewProfit: hasPermission('sales.viewProfit'),

    // Customers
    canViewCustomers: hasPermission('customers.read'),
    canCreateCustomer: hasPermission('customers.create'),
    canEditCustomer: hasPermission('customers.update'),
    canDeleteCustomer: hasPermission('customers.delete'),
    canViewCustomerBalance: hasPermission('customers.viewBalance'),

    // Suppliers
    canViewSuppliers: hasPermission('suppliers.read'),
    canCreateSupplier: hasPermission('suppliers.create'),
    canEditSupplier: hasPermission('suppliers.update'),
    canDeleteSupplier: hasPermission('suppliers.delete'),

    // Invoices
    canViewInvoices: hasPermission('invoices.read'),
    canCreateInvoice: hasPermission('invoices.create'),
    canRecordPayment: hasPermission('invoices.payment'),

    // Expenses
    canViewExpenses: hasPermission('expenses.read'),
    canCreateExpense: hasPermission('expenses.create'),
    canEditExpense: hasPermission('expenses.update'),
    canDeleteExpense: hasPermission('expenses.delete'),
    canApproveExpense: hasPermission('expenses.approve'),

    // Reports (granular per category)
    canViewSalesReports: hasPermission('reports.sales'),
    canViewInventoryReports: hasPermission('reports.inventory'),
    canViewFinancialReports: hasPermission('reports.financial'),
    canViewCustomerReports: hasPermission('reports.customers'),
    canViewExpenseReports: hasPermission('reports.expenses'),
    canViewDiscountReports: hasPermission('reports.discounts'),
    canViewInvoiceReports: hasPermission('reports.invoices'),
    canExportReports: hasPermission('reports.export'),
    /** True if user has access to ANY report category */
    canAccessReports: hasAnyPermission(
      'reports.sales', 'reports.inventory', 'reports.financial',
      'reports.customers', 'reports.expenses', 'reports.discounts',
      'reports.invoices'
    ),

    // Users
    canViewUsers: hasPermission('users.read'),
    canCreateUser: hasPermission('users.create'),
    canEditUser: hasPermission('users.update'),
    canDeleteUser: hasPermission('users.delete'),

    // Settings
    canViewSettings: hasPermission('settings.read'),
    canEditSettings: hasPermission('settings.update'),
    canManageRoles: hasPermission('settings.roles'),
    canResetSystem: hasPermission('settings.reset'),

    // POS
    canAccessPOS: hasPermission('pos.access'),
    canHoldOrders: hasPermission('pos.hold'),
    canApplyItemDiscount: hasPermission('pos.discount'),
    canApplyCartDiscount: hasPermission('pos.cartDiscount'),
    canOverridePrice: hasPermission('pos.priceOverride'),
    canCreditSale: hasPermission('pos.creditSale'),
    /** Shortcut: can apply any type of discount at POS */
    canApplyDiscount: hasAnyPermission('pos.discount', 'pos.cartDiscount', 'discounts.apply'),

    // Discounts (standalone module)
    canViewDiscounts: hasPermission('discounts.view'),
    canApplyDiscountGeneral: hasPermission('discounts.apply'),
    canUnlimitedDiscount: hasPermission('discounts.unlimited'),

    // Cash Register
    canOpenRegister: hasPermission('cashregister.open'),
    canCloseRegister: hasPermission('cashregister.close'),
    canRecordCashMovement: hasPermission('cashregister.movement'),
    canViewRegisterHistory: hasPermission('cashregister.view'),
  };
}
