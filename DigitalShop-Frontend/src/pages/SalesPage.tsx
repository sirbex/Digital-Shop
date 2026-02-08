import { useState, useEffect, useCallback } from 'react';
import { salesApi, api, type ApiResponse } from '../lib/api';
import { Receipt } from '../components/pos/Receipt';
import { usePrint } from '../hooks/usePrint';
import { RefundModal } from '../components/sales/RefundModal';
import { VoidSaleButton } from '../components/sales/VoidSaleButton';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { z } from 'zod';
import { CreateRefundSchema, VoidSaleSchema } from '@shared/zod/saleRefund';
import { 
  SalesFilterSchema, 
  PrintReceiptSchema,
  type SalesFilter 
} from '@shared/zod/sale';

// Date preset options
type DatePreset = 'today' | 'yesterday' | 'last3days' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | '2monthsBack' | 'custom' | 'all';

// Zod schema for date preset validation
const DatePresetSchema = z.enum(['today', 'yesterday', 'last3days', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', '2monthsBack', 'custom', 'all']);

// Helper function to calculate date ranges
// FOLLOWS: UTC Everywhere strategy from COPILOT_IMPLEMENTATION_RULES.md
function getDateRange(preset: DatePreset): { startDate: string; endDate: string } {
  // Get current UTC date as YYYY-MM-DD string
  const now = new Date();
  const todayUTC = now.toISOString().split('T')[0]; // e.g., "2026-01-30"
  
  // Helper to add/subtract days from a date string
  const addDays = (dateStr: string, days: number): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    return date.toISOString().split('T')[0];
  };
  
  // Helper to get start of week (Sunday) for a date string
  const getStartOfWeek = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = date.getUTCDay(); // 0 = Sunday
    return addDays(dateStr, -dayOfWeek);
  };
  
  // Helper to get start of month
  const getStartOfMonth = (dateStr: string): string => {
    const [year, month] = dateStr.split('-').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-01`;
  };
  
  // Helper to get end of month
  const getEndOfMonth = (year: number, month: number): string => {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };
  
  switch (preset) {
    case 'today':
      return { startDate: todayUTC, endDate: todayUTC };
    
    case 'yesterday': {
      const yesterday = addDays(todayUTC, -1);
      return { startDate: yesterday, endDate: yesterday };
    }
    
    case 'last3days': {
      const threeDaysAgo = addDays(todayUTC, -2);
      return { startDate: threeDaysAgo, endDate: todayUTC };
    }
    
    case 'thisWeek': {
      const startOfWeek = getStartOfWeek(todayUTC);
      return { startDate: startOfWeek, endDate: todayUTC };
    }
    
    case 'lastWeek': {
      const startOfThisWeek = getStartOfWeek(todayUTC);
      const startOfLastWeek = addDays(startOfThisWeek, -7);
      const endOfLastWeek = addDays(startOfThisWeek, -1);
      return { startDate: startOfLastWeek, endDate: endOfLastWeek };
    }
    
    case 'thisMonth': {
      const startOfMonth = getStartOfMonth(todayUTC);
      return { startDate: startOfMonth, endDate: todayUTC };
    }
    
    case 'lastMonth': {
      const [year, month] = todayUTC.split('-').map(Number);
      const lastMonth = month === 1 ? 12 : month - 1;
      const lastMonthYear = month === 1 ? year - 1 : year;
      const startOfLastMonth = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;
      const endOfLastMonth = getEndOfMonth(lastMonthYear, lastMonth);
      return { startDate: startOfLastMonth, endDate: endOfLastMonth };
    }
    
    case '2monthsBack': {
      const [year, month] = todayUTC.split('-').map(Number);
      let twoMonthsBack = month - 2;
      let twoMonthsBackYear = year;
      if (twoMonthsBack <= 0) {
        twoMonthsBack += 12;
        twoMonthsBackYear -= 1;
      }
      const startOf2MonthsBack = `${twoMonthsBackYear}-${String(twoMonthsBack).padStart(2, '0')}-01`;
      const endOf2MonthsBack = getEndOfMonth(twoMonthsBackYear, twoMonthsBack);
      return { startDate: startOf2MonthsBack, endDate: endOf2MonthsBack };
    }
    
    case 'all':
    case 'custom':
    default:
      return { startDate: '', endDate: '' };
  }
}

// Sale Details Modal Component
function SaleDetailsModal({ sale, onClose, onPrint, showProfit = true }: { sale: any; onClose: () => void; onPrint: () => void; showProfit?: boolean }) {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sale Details</h2>
            <p className="text-sm text-gray-600">{sale.saleNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Sale Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Date</p>
              <p className="text-sm font-medium">{new Date(sale.saleDate).toLocaleDateString()}</p>
              <p className="text-xs text-gray-500">{new Date(sale.createdAt).toLocaleTimeString()}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Customer</p>
              <p className="text-sm font-medium">{sale.customerName || 'Walk-in'}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Payment</p>
              <p className="text-sm font-medium">{sale.paymentMethod}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Status</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                sale.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                sale.status === 'VOID' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {sale.status}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border rounded-lg overflow-hidden mb-6">
            {/* Check if any item has discount */}
            {(() => {
              const hasAnyDiscount = sale.items?.some((item: any) => parseFloat(item.discountAmount || 0) > 0);
              return (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Product</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Qty</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Unit Price</th>
                      {hasAnyDiscount && (
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Discount</th>
                      )}
                      <th className="px-4 py-3 text-right font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sale.items?.map((item: any, index: number) => {
                      const itemDiscount = parseFloat(item.discountAmount || 0);
                      const itemSubtotal = item.quantity * parseFloat(item.unitPrice);
                      const itemTotal = item.totalAmount || item.total_price || (itemSubtotal - itemDiscount);
                      return (
                        <tr key={item.id || index} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{item.productName}</div>
                            {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                          </td>
                          <td className="px-4 py-3 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-right">UGX {parseFloat(item.unitPrice).toLocaleString()}</td>
                          {hasAnyDiscount && (
                            <td className="px-4 py-3 text-right text-red-600">
                              {itemDiscount > 0 ? `- UGX ${itemDiscount.toLocaleString()}` : '-'}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-medium">
                            UGX {parseFloat(String(itemTotal)).toLocaleString()}
                          </td>
                        </tr>
                      );
                    }) || (
                      <tr>
                        <td colSpan={hasAnyDiscount ? 5 : 4} className="px-4 py-8 text-center text-gray-500">
                          No items found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>UGX {parseFloat(sale.subtotal || sale.totalAmount).toLocaleString()}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Discount</span>
                <span>- UGX {parseFloat(sale.discountAmount).toLocaleString()}</span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax</span>
                <span>UGX {parseFloat(sale.taxAmount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-blue-600">UGX {parseFloat(sale.totalAmount).toLocaleString()}</span>
            </div>
            {/* Show Amount Paid and Balance for partial payments */}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Amount Paid</span>
              <span className="text-green-600">UGX {parseFloat(sale.amountPaid || sale.totalAmount).toLocaleString()}</span>
            </div>
            {parseFloat(sale.amountPaid || sale.totalAmount) < parseFloat(sale.totalAmount) - 0.01 && (
              <div className="flex justify-between text-sm font-semibold bg-orange-100 -mx-4 px-4 py-2">
                <span className="text-orange-700">⚠️ Balance Due (Invoice)</span>
                <span className="text-orange-700">UGX {(parseFloat(sale.totalAmount) - parseFloat(sale.amountPaid || sale.totalAmount)).toLocaleString()}</span>
              </div>
            )}
            {parseFloat(sale.changeAmount || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Change Given</span>
                <span>UGX {parseFloat(sale.changeAmount).toLocaleString()}</span>
              </div>
            )}
            {showProfit && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Profit</span>
              <span>UGX {parseFloat(sale.profit || 0).toLocaleString()} ({(sale.profitMargin || 0).toFixed(1)}%)</span>
            </div>
            )}
          </div>

          {/* Cashier Info */}
          {sale.cashierName && (
            <div className="mt-4 text-xs text-gray-500 text-center">
              Served by: {sale.cashierName}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onPrint}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function SalesPage() {
  const { user } = useAuth();
  const { printRef, handlePrint } = usePrint();
  const [_sales, setSales] = useState<any[]>([]);
  const [filteredSales, setFilteredSales] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Other filters
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('COMPLETED');
  
  // UI state
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [viewingSale, setViewingSale] = useState<any>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState<any>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const perms = usePermissions();

  // Handle date preset change
  const handleDatePresetChange = (preset: DatePreset) => {
    try {
      DatePresetSchema.parse(preset);
      setDatePreset(preset);
      
      if (preset === 'all') {
        // Clear dates for all-time filter
        setStartDate('');
        setEndDate('');
      } else if (preset !== 'custom') {
        const { startDate: start, endDate: end } = getDateRange(preset);
        setStartDate(start);
        setEndDate(end);
      }
      // For 'custom', keep existing dates and let user choose
    } catch (err) {
      console.error('Invalid date preset:', err);
    }
  };

  // Initialize with today's date on mount
  useEffect(() => {
    const { startDate: start, endDate: end } = getDateRange('today');
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Validate filters with Zod before applying
  const validateAndBuildFilters = useCallback((): SalesFilter | null => {
    try {
      setFilterError(null);
      
      const rawFilters = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        status: statusFilter || undefined,
      };

      const validated = SalesFilterSchema.parse(rawFilters);
      return validated;
    } catch (err) {
      if (err instanceof z.ZodError) {
        setFilterError(err.issues[0].message);
      }
      return null;
    }
  }, [startDate, endDate, paymentMethodFilter, statusFilter]);

  useEffect(() => {
    loadSales();
  }, [startDate, endDate, paymentMethodFilter, statusFilter]);

  const loadSales = async () => {
    const validatedFilters = validateAndBuildFilters();
    if (validatedFilters === null && (startDate || endDate)) {
      return;
    }

    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      
      // Only add non-empty filter values
      if (validatedFilters?.startDate) {
        params.startDate = validatedFilters.startDate;
      }
      if (validatedFilters?.endDate) {
        params.endDate = validatedFilters.endDate;
      }
      if (validatedFilters?.paymentMethod) {
        params.paymentMethod = validatedFilters.paymentMethod;
      }
      if (validatedFilters?.status) {
        params.status = validatedFilters.status;
      }

      const response = await salesApi.getAll(params);
      
      if (response.data.success) {
        setSales(response.data.data);
        setFilteredSales(response.data.data);
      } else {
        console.error('Sales API returned error:', response.data.error);
      }
    } catch (error) {
      console.error('Failed to load sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    const total = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || 0), 0);
    const profit = filteredSales.reduce((sum, sale) => sum + parseFloat(sale.profit || 0), 0);
    const avgMargin =
      filteredSales.length > 0
        ? filteredSales.reduce((sum, sale) => sum + parseFloat(sale.profitMargin || 0), 0) / filteredSales.length
        : 0;

    return {
      count: filteredSales.length,
      total,
      profit,
      avgMargin,
    };
  };

  const handleViewSale = async (sale: any) => {
    try {
      PrintReceiptSchema.parse({ saleId: sale.id });
      const response = await salesApi.getById(sale.id);
      if (response.data.success) {
        setViewingSale(response.data.data);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        alert(`Invalid sale: ${err.issues[0].message}`);
      }
    }
  };

  const handleReprintReceipt = (sale: any) => {
    try {
      PrintReceiptSchema.parse({ saleId: sale.id });
      setSelectedSale(sale);
      setTimeout(() => {
        handlePrint();
      }, 100);
    } catch (err) {
      if (err instanceof z.ZodError) {
        alert(`Print validation error: ${err.issues[0].message}`);
      }
    }
  };

  const handleRefund = async (data: z.infer<typeof CreateRefundSchema>) => {
    try {
      const refundData = data as { saleId: string; [key: string]: any };
      const response = await api.post<ApiResponse>(`/sales/${refundData.saleId}/refund`, data);
      const responseData = response.data as ApiResponse;
      if (responseData.success) {
        await loadSales();
        setRefundModalOpen(false);
        setSaleToRefund(null);
        alert('Refund processed successfully');
      }
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to process refund');
    }
  };

  const handleVoid = async (data: z.infer<typeof VoidSaleSchema>) => {
    try {
      // Extract saleId for URL, send only voidReason and notes in body
      const { saleId, voidReason, notes } = data as { saleId: string; voidReason: string; notes: string };
      const response = await api.post<ApiResponse>(`/sales/${saleId}/void`, {
        voidReason,
        notes
      });
      const responseData = response.data as ApiResponse;
      if (responseData.success) {
        await loadSales();
        alert('Sale voided successfully');
      }
    } catch (error: any) {
      throw new Error(error?.message || 'Failed to void sale');
    }
  };

  const totals = calculateTotals();

  // Hidden Receipt for Printing
  // Calculate amount tendered (amount given by customer) and balance due
  const getReceiptPaymentData = (sale: any) => {
    const totalAmount = sale.totalAmount || 0;
    const amountPaid = sale.amountPaid || 0;
    const changeAmount = sale.changeAmount || 0;
    
    // Amount tendered = amountPaid (what customer actually gave)
    // Backend stores amountPaid as the full amount the customer handed over
    // Change is calculated separately and stored in changeAmount
    const amountTendered = amountPaid;
    
    // Balance due for credit sales (when total > amountPaid and no change)
    // If there's change, customer paid more than needed, so no balance due
    const balanceDue = changeAmount > 0 ? 0 : Math.max(0, totalAmount - amountPaid);
    
    return { amountTendered, balanceDue, changeAmount };
  };

  const receiptElement = selectedSale && (
    <div className="hidden">
      <Receipt
        ref={printRef}
        saleNumber={selectedSale.saleNumber}
        date={selectedSale.saleDate}
        items={selectedSale.items?.map((item: any) => ({
          productName: item.productName || 'Product',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.totalAmount ?? (item.quantity * item.unitPrice - (item.discountAmount || 0)),
          discount: item.discountAmount || 0,
        })) || []}
        subtotal={selectedSale.subtotal || 0}
        discountAmount={selectedSale.discountAmount || 0}
        taxAmount={selectedSale.taxAmount || 0}
        total={selectedSale.totalAmount}
        paymentMethod={selectedSale.paymentMethod}
        amountPaid={selectedSale.amountPaid || selectedSale.totalAmount}
        amountTendered={getReceiptPaymentData(selectedSale).amountTendered}
        change={getReceiptPaymentData(selectedSale).changeAmount}
        balanceDue={getReceiptPaymentData(selectedSale).balanceDue}
        customerName={selectedSale.customerName}
      />
    </div>
  );

  if (isLoading) {
    return <div className="text-center py-12">Loading sales...</div>;
  }

  return (
    <div className="space-y-4">
      {receiptElement}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sales History</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
            <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Zod Validated
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900">{totals.count}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Revenue</p>
          <p className="text-2xl font-bold text-blue-600">
            UGX {totals.total.toLocaleString()}
          </p>
        </div>
        {perms.canViewProfit && (
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Profit</p>
          <p className="text-2xl font-bold text-green-600">
            UGX {totals.profit.toLocaleString()}
          </p>
        </div>
        )}
        {perms.canViewProfit && (
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Avg Margin</p>
          <p className="text-2xl font-bold text-gray-900">{totals.avgMargin.toFixed(1)}%</p>
        </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        {filterError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span><strong>Validation Error:</strong> {filterError}</span>
          </div>
        )}

        {/* Other Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Date range filter"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last3days">Last 3 Days</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="2monthsBack">2 Months Ago</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by payment method"
            >
              <option value="">All Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              <option value="COMPLETED">Completed</option>
              <option value="VOID">Voided</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadSales}
              disabled={!!filterError}
              className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                filterError 
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Custom Date Range (only shown when custom is selected) */}
        {datePreset === 'custom' && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <label className="block text-sm font-medium text-blue-800 mb-2">Custom Date Range</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-blue-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${filterError?.includes('Start date') ? 'border-red-500' : 'border-blue-300'}`}
                  aria-label="Start date"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg ${filterError?.includes('end date') ? 'border-red-500' : 'border-blue-300'}`}
                  aria-label="End date"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Summary */}
        {(startDate || endDate) && datePreset !== 'all' && (
          <div className="mt-3 text-sm text-gray-600">
            Showing sales from <strong>{startDate || 'beginning'}</strong> to <strong>{endDate || 'now'}</strong>
          </div>
        )}
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              {perms.canViewProfit && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  No sales found for the selected period
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => handleViewSale(sale)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {sale.saleNumber}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {new Date(sale.saleDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(sale.createdAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {sale.customerName || 'Walk-in'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      UGX {parseFloat(sale.totalAmount).toLocaleString()}
                    </div>
                    {/* Show partial payment indicator */}
                    {parseFloat(sale.amountPaid || sale.totalAmount) < parseFloat(sale.totalAmount) - 0.01 && (
                      <div className="text-xs text-orange-600 font-medium">
                        ⚠️ Paid: UGX {parseFloat(sale.amountPaid).toLocaleString()}
                      </div>
                    )}
                  </td>
                  {perms.canViewProfit && (
                  <td className="px-6 py-4">
                    <div className="text-sm text-green-600">
                      UGX {parseFloat(sale.profit || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(parseFloat(sale.profitMargin || 0)).toFixed(1)}%
                    </div>
                  </td>
                  )}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {sale.paymentMethod}
                    </span>
                    {/* Show partial payment badge */}
                    {parseFloat(sale.amountPaid || sale.totalAmount) < parseFloat(sale.totalAmount) - 0.01 && (
                      <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        PARTIAL
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sale.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : sale.status === 'VOID'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewSale(sale)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                        title="View sale details"
                      >
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      {(perms.canVoidSale || perms.canRefundSale) && sale.status === 'COMPLETED' && (
                        <>
                          {perms.canRefundSale && (
                          <button
                            onClick={async () => {
                              try {
                                PrintReceiptSchema.parse({ saleId: sale.id });
                                const response = await salesApi.getById(sale.id);
                                if (response.data.success) {
                                  setSaleToRefund(response.data.data);
                                  setRefundModalOpen(true);
                                }
                              } catch (err) {
                                if (err instanceof z.ZodError) {
                                  alert(`Invalid sale: ${err.issues[0].message}`);
                                }
                              }
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors"
                            title="Process refund"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                            Refund
                          </button>
                          )}
                          {perms.canVoidSale && (
                          <VoidSaleButton sale={sale} onVoid={handleVoid} />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sale Details Modal */}
      {viewingSale && (
        <SaleDetailsModal
          sale={viewingSale}
          onClose={() => setViewingSale(null)}
          onPrint={() => handleReprintReceipt(viewingSale)}
          showProfit={perms.canViewProfit}
        />
      )}

      {/* Refund Modal */}
      {refundModalOpen && saleToRefund && (
        <RefundModal
          isOpen={refundModalOpen}
          onClose={() => {
            setRefundModalOpen(false);
            setSaleToRefund(null);
          }}
          sale={saleToRefund}
          onSubmit={handleRefund}
        />
      )}
    </div>
  );
}
