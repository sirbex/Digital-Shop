import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8340/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API Response type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse>('/auth/login', { email, password }),
  
  register: (data: { email: string; password: string; fullName: string; role?: string }) =>
    api.post<ApiResponse>('/auth/register', data),
  
  getCurrentUser: () =>
    api.get<ApiResponse>('/auth/me'),
  
  getMyPermissions: () =>
    api.get<ApiResponse<string[]>>('/auth/permissions'),
  
  logout: () =>
    api.post<ApiResponse>('/auth/logout'),
};

// Products API
export const productsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/products', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/products/${id}`),
  
  getBySku: (sku: string) =>
    api.get<ApiResponse>(`/products/sku/${sku}`),
  
  getByBarcode: (barcode: string) =>
    api.get<ApiResponse>(`/products/barcode/${barcode}`),
  
  getLowStock: () =>
    api.get<ApiResponse>('/products/low-stock'),
  
  create: (data: any) =>
    api.post<ApiResponse>('/products', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse>(`/products/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/products/${id}`),
};

// Customers API
export const customersApi = {
  getAll: () =>
    api.get<ApiResponse>('/customers'),
  
  search: (query: string) =>
    api.get<ApiResponse>('/customers/search', { params: { q: query } }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/customers/${id}`),
  
  getTransactions: (id: string) =>
    api.get<ApiResponse>(`/customers/${id}/transactions`),
  
  getInvoices: (customerId: string) =>
    api.get<ApiResponse>(`/customers/${customerId}/invoices`),
  
  // QuickBooks-style customer ledger with running balance
  getLedger: (id: string, params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>(`/customers/${id}/ledger`, { params }),
  
  // Customer account summary with aging (like QuickBooks)
  getAccountSummary: (id: string) =>
    api.get<ApiResponse>(`/customers/${id}/account-summary`),
  
  // Customers with outstanding balance
  getWithBalance: () =>
    api.get<ApiResponse>('/customers/with-balance'),
  
  checkCredit: (id: string, amount: number) =>
    api.post<ApiResponse>(`/customers/${id}/check-credit`, { amount }),
  
  create: (data: any) =>
    api.post<ApiResponse>('/customers', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse>(`/customers/${id}`, data),
};

// Invoices API
export const invoicesApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/invoices', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/invoices/${id}`),
  
  getByCustomer: (customerId: string) =>
    api.get<ApiResponse>(`/customers/${customerId}/invoices`),
  
  getOverdue: () =>
    api.get<ApiResponse>('/invoices/overdue'),
  
  getSummary: (customerId?: string) =>
    api.get<ApiResponse>('/invoices/summary', { params: { customerId } }),
  
  create: (data: any) =>
    api.post<ApiResponse>('/invoices', data),
  
  recordPayment: (invoiceId: string, paymentData: any) =>
    api.post<ApiResponse>(`/invoices/${invoiceId}/payments`, paymentData),
  
  getPayments: (invoiceId: string) =>
    api.get<ApiResponse>(`/invoices/${invoiceId}/payments`),
};

// Sales API
export const salesApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/sales', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/sales/${id}`),
  
  getBySaleNumber: (saleNumber: string) =>
    api.get<ApiResponse>(`/sales/number/${saleNumber}`),
  
  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/sales/summary', { params }),
  
  getTopProducts: (params?: { limit?: number; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/sales/top-products', { params }),
  
  create: (data: any) =>
    api.post<ApiResponse>('/sales', data),
};

// Inventory API
export const inventoryApi = {
  getBatches: (params?: any) =>
    api.get<ApiResponse>('/inventory/batches', { params }),
  
  getBatchById: (id: string) =>
    api.get<ApiResponse>(`/inventory/batches/${id}`),
  
  getAvailableBatches: (productId: string) =>
    api.get<ApiResponse>(`/inventory/batches/product/${productId}`),
  
  selectBatches: (productId: string, quantity: number) =>
    api.post<ApiResponse>('/inventory/batches/select', { productId, quantity }),
  
  getMovements: (params?: any) =>
    api.get<ApiResponse>('/inventory/movements', { params }),
  
  adjust: (data: any) =>
    api.post<ApiResponse>('/inventory/adjust', data),
  
  getLowStock: () =>
    api.get<ApiResponse>('/inventory/low-stock'),
  
  getValuation: () =>
    api.get<ApiResponse>('/inventory/valuation'),
  
  getExpiring: (days?: number) =>
    api.get<ApiResponse>('/inventory/expiring', { params: { days } }),

  getStockLevels: () =>
    api.get<ApiResponse>('/inventory/stock-levels'),
  
  getStockLevelByProduct: (productId: string) =>
    api.get<ApiResponse>(`/inventory/stock-levels/${productId}`),
  
  batchExists: (batchNumber: string) =>
    api.get<ApiResponse>('/inventory/batches/exists', { params: { batchNumber } }),
  
  getBatchesExpiring: (days?: number) =>
    api.get<ApiResponse>('/inventory/batches/expiring', { params: { days } }),
  
  getReorderList: () =>
    api.get<ApiResponse>('/inventory/reorder'),
  
  getInventoryValue: () =>
    api.get<ApiResponse>('/inventory/value'),
  
  getProductMovements: (productId: string) =>
    api.get<ApiResponse>(`/inventory/movements/product/${productId}`),
  
  getProductHistory: (productId: string) =>
    api.get<ApiResponse>(`/inventory/product-history/${productId}`),
  
  getProductDetails: (productId: string) =>
    api.get<ApiResponse>(`/inventory/product-details/${productId}`),
};

// Suppliers API
export const suppliersApi = {
  getAll: () =>
    api.get<ApiResponse>('/suppliers'),
  
  search: (query: string) =>
    api.get<ApiResponse>('/suppliers/search', { params: { q: query } }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/suppliers/${id}`),
  
  create: (data: any) =>
    api.post<ApiResponse>('/suppliers', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse>(`/suppliers/${id}`, data),
};

// Purchase Orders API
export const purchasesApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/purchases', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/purchases/${id}`),
  
  create: (data: any) =>
    api.post<ApiResponse>('/purchases', data),
  
  submit: (id: string) =>
    api.post<ApiResponse>(`/purchases/${id}/submit`),
  
  approve: (id: string) =>
    api.post<ApiResponse>(`/purchases/${id}/approve`),
  
  cancel: (id: string) =>
    api.post<ApiResponse>(`/purchases/${id}/cancel`),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/purchases/${id}`),
  
  updateStatus: (id: string, status: string) =>
    api.put<ApiResponse>(`/purchases/${id}/status`, { status }),
};

// Goods Receipts API
import type { UpdateGoodsReceiptItem, CreateGoodsReceiptFromPO } from '@shared/zod/goodsReceipt';

export const goodsReceiptsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/goods-receipts', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/goods-receipts/${id}`),
  
  getSummary: () =>
    api.get<ApiResponse>('/goods-receipts/summary'),
  
  create: (data: CreateGoodsReceiptFromPO) =>
    api.post<ApiResponse>('/goods-receipts', data),
  
  hydrateFromPO: (purchaseOrderId: string) =>
    api.post<ApiResponse>('/goods-receipts/hydrate-from-po', { purchaseOrderId }),
  
  updateItem: (grId: string, itemId: string, data: UpdateGoodsReceiptItem) =>
    api.put<ApiResponse>(`/goods-receipts/${grId}/items/${itemId}`, data),
  
  finalize: (id: string) =>
    api.post<ApiResponse>(`/goods-receipts/${id}/finalize`),
  
  cancel: (id: string) =>
    api.post<ApiResponse>(`/goods-receipts/${id}/cancel`),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/goods-receipts/${id}`),
};

// Stock Adjustments API
export const stockAdjustmentsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/stock-adjustments', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/stock-adjustments/${id}`),
  
  getSummary: () =>
    api.get<ApiResponse>('/stock-adjustments/summary'),
  
  getTypes: () =>
    api.get<ApiResponse>('/stock-adjustments/types'),
  
  create: (data: any) =>
    api.post<ApiResponse>('/stock-adjustments', data),
  
  approve: (id: string, notes?: string) =>
    api.post<ApiResponse>(`/stock-adjustments/${id}/approve`, { notes }),
  
  reject: (id: string, notes?: string) =>
    api.post<ApiResponse>(`/stock-adjustments/${id}/reject`, { notes }),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/stock-adjustments/${id}`),
};

// Stock Movements API
export const stockMovementsApi = {
  getAll: (params?: any) =>
    api.get<ApiResponse>('/stock-movements', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/stock-movements/${id}`),
  
  getSummary: () =>
    api.get<ApiResponse>('/stock-movements/summary'),
  
  getByProduct: (productId: string, params?: any) =>
    api.get<ApiResponse>(`/stock-movements/product/${productId}`, { params }),
  
  getByBatch: (batchId: string, params?: any) =>
    api.get<ApiResponse>(`/stock-movements/batch/${batchId}`, { params }),
};

// Users API
export const usersApi = {
  getAll: () =>
    api.get<ApiResponse>('/users'),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/users/${id}`),
  
  getStats: () =>
    api.get<ApiResponse>('/users/stats'),
  
  getByRole: (role: string) =>
    api.get<ApiResponse>(`/users/role/${role}`),
  
  create: (data: any) =>
    api.post<ApiResponse>('/auth/register', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse>(`/users/${id}`, data),
  
  resetPassword: (id: string, newPassword: string) =>
    api.post<ApiResponse>(`/users/${id}/reset-password`, { newPassword }),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/users/${id}`),
};

// POS Hold API
export const holdApi = {
  // Create a new held order
  create: (data: any) =>
    api.post<ApiResponse>('/pos/hold', data),
  
  // List all held orders for current user
  list: () =>
    api.get<ApiResponse>('/pos/hold'),
  
  // Get a specific held order by ID
  getById: (id: string) =>
    api.get<ApiResponse>(`/pos/hold/${id}`),
  
  // Delete (resume) a held order
  delete: (id: string) =>
    api.delete<ApiResponse>(`/pos/hold/${id}`),
};

// Reports API
export const reportsApi = {
  // Sales Reports
  getDailySales: (date?: string) =>
    api.get<ApiResponse>('/reports/daily-sales', { params: { date } }),
  
  getSalesDetails: (params?: { startDate?: string; endDate?: string; customerId?: string; cashierId?: string; paymentMethod?: string; status?: string }) =>
    api.get<ApiResponse>('/reports/sales-details', { params }),
  
  getSalesSummary: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/sales-summary', { params: { startDate, endDate } }),

  getSalesByHour: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/sales-by-hour', { params: { startDate, endDate } }),

  getSalesByCashier: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/sales-by-cashier', { params: { startDate, endDate } }),

  getSalesTrends: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/sales-trends', { params: { startDate, endDate } }),

  getPaymentMethodAnalysis: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/payment-methods', { params: { startDate, endDate } }),

  // Profit & Loss
  getProfitLoss: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/profit-loss', { params: { startDate, endDate } }),

  // Customer Reports
  getCustomerAccounts: (params?: { hasBalance?: boolean; customerId?: string }) =>
    api.get<ApiResponse>('/reports/customer-accounts', { params }),
  
  getCustomerAging: () =>
    api.get<ApiResponse>('/reports/customer-aging'),

  // Inventory Reports
  getStockValuation: (costingMethod?: string) =>
    api.get<ApiResponse>('/reports/stock-valuation', { params: { costingMethod } }),
  
  getInventory: (params?: { lowStock?: boolean; expiringSoon?: boolean; categoryId?: string }) =>
    api.get<ApiResponse>('/reports/inventory', { params }),
  
  getOutOfStock: () =>
    api.get<ApiResponse>('/reports/out-of-stock'),

  getInventoryMovements: (params: { startDate: string; endDate: string; productId?: string; movementType?: string }) =>
    api.get<ApiResponse>('/reports/inventory-movements', { params }),

  getSlowMoving: (days?: number) =>
    api.get<ApiResponse>('/reports/slow-moving', { params: { days } }),

  getFastMoving: (params: { startDate: string; endDate: string; limit?: number }) =>
    api.get<ApiResponse>('/reports/fast-moving', { params }),

  getExpiringStock: (days?: number) =>
    api.get<ApiResponse>('/reports/expiring-stock', { params: { days } }),

  getStockReorder: () =>
    api.get<ApiResponse>('/reports/reorder'),

  getInventoryTurnover: (startDate: string, endDate: string) =>
    api.get<ApiResponse>('/reports/inventory-turnover', { params: { startDate, endDate } }),

  // Best Selling Reports
  getBestSelling: (params?: { startDate?: string; endDate?: string; limit?: number; sortBy?: string }) =>
    api.get<ApiResponse>('/reports/best-selling', { params }),
  
  getBestSellingCategories: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/reports/best-selling-categories', { params }),

  // Invoice Reports
  getInvoices: (params?: { startDate?: string; endDate?: string; customerId?: string; status?: string }) =>
    api.get<ApiResponse>('/reports/invoices', { params }),
  
  getInvoiceSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/reports/invoice-summary', { params }),

  // Voided & Refund Reports
  getVoided: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/reports/voided', { params }),
  
  getRefunds: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/reports/refunds', { params }),

  // Discount Reports
  getDiscounts: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/discounts', { params }),
  
  getDiscountsByCashier: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/discounts-by-cashier', { params }),

  // Income / Payments Received Reports
  getPaymentsReceived: (params: { startDate: string; endDate: string; customerId?: string; paymentMethod?: string }) =>
    api.get<ApiResponse>('/reports/payments-received', { params }),
  
  getPaymentsSummary: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/payments-summary', { params }),
  
  getDailyCollections: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/daily-collections', { params }),

  // Expense Reports
  getExpenseReport: (params: { startDate: string; endDate: string; category?: string; paymentMethod?: string }) =>
    api.get<ApiResponse>('/reports/expenses', { params }),
  
  getExpenseSummary: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/expense-summary', { params }),
  
  getExpenseByCategory: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/expense-by-category', { params }),
  
  getDailyExpenses: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/daily-expenses', { params }),
  
  getIncomeVsExpense: (params: { startDate: string; endDate: string }) =>
    api.get<ApiResponse>('/reports/income-vs-expense', { params }),

  // Dashboard Summary
  getDashboard: () =>
    api.get<ApiResponse>('/reports/dashboard'),

  // Legacy (backward compatibility)
  getSales: (params?: { startDate?: string; endDate?: string; customerId?: string; paymentMethod?: string }) =>
    api.get<ApiResponse>('/reports/sales', { params }),
  
  getProductPerformance: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get<ApiResponse>('/reports/product-performance', { params }),
  
  getDailySummary: (date: string) =>
    api.get<ApiResponse>('/reports/daily-summary', { params: { date } }),
};

// Expenses API
export const expensesApi = {
  getAll: (params?: { startDate?: string; endDate?: string; category?: string; paymentMethod?: string; status?: string }) =>
    api.get<ApiResponse>('/expenses', { params }),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/expenses/${id}`),
  
  getCategories: () =>
    api.get<ApiResponse>('/expenses/categories'),
  
  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/expenses/summary', { params }),
  
  getByCategory: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse>('/expenses/by-category', { params }),
  
  create: (data: any) =>
    api.post<ApiResponse>('/expenses', data),
  
  update: (id: string, data: any) =>
    api.put<ApiResponse>(`/expenses/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/expenses/${id}`),
};

// System Settings API
export const systemApi = {
  getSettings: () =>
    api.get<ApiResponse>('/system/settings'),
  
  getPublicSettings: () =>
    api.get<ApiResponse>('/system/settings/public'),
  
  updateSettings: (data: any) =>
    api.patch<ApiResponse>('/system/settings', data),
  
  getDatabaseStats: () =>
    api.get<ApiResponse>('/system/stats'),
  
  getResetPreview: () =>
    api.get<ApiResponse>('/system/reset/preview'),
  
  executeReset: (data: { confirmText: string; reason: string }) =>
    api.post<ApiResponse>('/system/reset', data),
};

// Roles & Permissions API
export const rolesApi = {
  getPermissions: () =>
    api.get<ApiResponse>('/roles/permissions'),
  
  getAll: () =>
    api.get<ApiResponse>('/roles'),
  
  getById: (id: string) =>
    api.get<ApiResponse>(`/roles/${id}`),
  
  create: (data: { name: string; description: string; permissionKeys: string[] }) =>
    api.post<ApiResponse>('/roles', data),
  
  update: (id: string, data: { name?: string; description?: string; permissionKeys?: string[] }) =>
    api.put<ApiResponse>(`/roles/${id}`, data),
  
  delete: (id: string) =>
    api.delete<ApiResponse>(`/roles/${id}`),
};
