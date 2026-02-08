/**
 * PrintReceiptDialog Component
 * Handles receipt printing with keyboard shortcuts (Enter to print, Esc to close)
 * Features:
 * - Keyboard shortcuts (Enter to print, Esc to cancel)
 * - Print format selection (detailed/compact)
 * - Print success/error feedback
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { X, Printer, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Receipt } from './Receipt';
import POSButton from './POSButton';

type PrintFormat = 'detailed' | 'compact';

export interface ReceiptData {
  saleNumber: string;
  saleDate: string;
  customerName?: string;
  cashierName?: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount?: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  payments?: Array<{
    method: string;
    amount: number;
    reference?: string;
  }>;
  amountPaid?: number;
  amountTendered?: number; // What customer actually gave
  change?: number;
  balanceDue?: number; // Outstanding balance for credit sales
}

interface PrintReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ReceiptData | null;
  onAfterPrint?: () => void;
}

export default function PrintReceiptDialog({
  open,
  onOpenChange,
  receiptData,
  onAfterPrint,
}: PrintReceiptDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>('detailed');
  const [rememberFormat, setRememberFormat] = useState(true);
  const [printStatus, setPrintStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const receiptRef = useRef<HTMLDivElement>(null);

  /**
   * Load saved preferences
   */
  useEffect(() => {
    if (open) {
      const savedFormat = localStorage.getItem('receipt_print_format');
      if (savedFormat === 'detailed' || savedFormat === 'compact') {
        setPrintFormat(savedFormat);
      }
      setPrintStatus('idle');
      setErrorMessage('');
    }
  }, [open]);

  /**
   * Format currency for display
   */
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: 'UGX',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * Execute print operation
   */
  const handlePrint = useCallback(async () => {
    if (!receiptData || isPrinting) {
      return;
    }

    try {
      setIsPrinting(true);
      setPrintStatus('idle');
      setErrorMessage('');

      // Save format preference if requested
      if (rememberFormat) {
        localStorage.setItem('receipt_print_format', printFormat);
      }

      // Use browser print
      const printContent = receiptRef.current;
      if (printContent) {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Receipt - ${receiptData.saleNumber}</title>
                <style>
                  body { 
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    margin: 0;
                    padding: 10px;
                    width: 80mm;
                  }
                  .receipt { width: 100%; }
                  @media print {
                    body { margin: 0; }
                    @page { size: 80mm auto; margin: 5mm; }
                  }
                </style>
              </head>
              <body>
                ${printContent.innerHTML}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }
      }

      setPrintStatus('success');
      setIsPrinting(false);

      // Execute callback
      onAfterPrint?.();

      // Close dialog after brief success message
      setTimeout(() => {
        onOpenChange(false);

        // Restore focus to POS search input after dialog closes
        setTimeout(() => {
          const searchInput = document.querySelector<HTMLInputElement>(
            'input[placeholder*="Search products"]'
          );
          searchInput?.focus();
        }, 150);
      }, 800);
    } catch (error) {
      console.error('Print failed:', error);
      setPrintStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to print receipt. Please try again.');
      setIsPrinting(false);
    }
  }, [receiptData, isPrinting, rememberFormat, printFormat, onOpenChange, onAfterPrint]);

  /**
   * Handle dialog close
   */
  const handleClose = useCallback(() => {
    if (isPrinting) {
      return;
    }
    onOpenChange(false);

    // Restore focus after dialog closes
    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>(
        'input[placeholder*="Search products"]'
      );
      searchInput?.focus();
    }, 100);
  }, [isPrinting, onOpenChange]);

  /**
   * Handle keyboard events
   */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !isPrinting) {
        e.preventDefault();
        handlePrint();
      }
      if (e.key === 'Escape' && !isPrinting) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isPrinting, handlePrint, handleClose]);

  /**
   * Reset printing state when dialog closes
   */
  useEffect(() => {
    if (!open) {
      setIsPrinting(false);
      setPrintStatus('idle');
      setErrorMessage('');
    }
  }, [open]);

  if (!open || !receiptData) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Print Receipt</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isPrinting}
            className="text-white/80 hover:text-white p-1"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Messages */}
          {printStatus === 'success' && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Receipt printed successfully!</span>
            </div>
          )}
          {printStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 mb-1">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-semibold">Print Failed</span>
              </div>
              <p className="text-sm text-red-700 ml-7">{errorMessage}</p>
            </div>
          )}

          {/* Print Format Options */}
          <div className="mb-4">
            <label className="text-sm font-semibold mb-2 block">Print Format</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printFormat"
                  value="detailed"
                  checked={printFormat === 'detailed'}
                  onChange={(e) => setPrintFormat(e.target.value as PrintFormat)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-sm">Detailed</div>
                  <div className="text-xs text-gray-500">Full itemized receipt with all details</div>
                </div>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="printFormat"
                  value="compact"
                  checked={printFormat === 'compact'}
                  onChange={(e) => setPrintFormat(e.target.value as PrintFormat)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-sm">Compact</div>
                  <div className="text-xs text-gray-500">Condensed format for thermal printers</div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="remember-format"
              checked={rememberFormat}
              onChange={(e) => setRememberFormat(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="remember-format" className="text-sm cursor-pointer">
              Remember my preference
            </label>
          </div>

          <p className="text-sm text-gray-600 text-center mb-4">
            Press <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">ENTER</kbd> to print or{' '}
            <kbd className="px-2 py-1 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">ESC</kbd> to cancel.
          </p>

          {/* Receipt Preview */}
          <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sale Number:</span>
              <span className="font-semibold">{receiptData.saleNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">{receiptData.saleDate}</span>
            </div>
            {receiptData.customerName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{receiptData.customerName}</span>
              </div>
            )}
            {receiptData.items && receiptData.items.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items:</span>
                <span className="font-medium">{receiptData.items.length}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              {receiptData.subtotal !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatCurrency(receiptData.subtotal)}</span>
                </div>
              )}
              {receiptData.discountAmount !== undefined && receiptData.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receiptData.discountAmount)}</span>
                </div>
              )}
              {receiptData.taxAmount !== undefined && receiptData.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span>{formatCurrency(receiptData.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(receiptData.totalAmount)}</span>
              </div>
            </div>
            {receiptData.payments && receiptData.payments.length > 0 ? (
              <div className="space-y-1 text-sm pt-2 border-t">
                <div className="font-medium text-gray-700">Payment Methods:</div>
                {receiptData.payments.map((payment, idx) => (
                  <div key={idx} className="flex justify-between pl-2">
                    <span className="text-gray-600">
                      {payment.method === 'CREDIT' ? 'Balance' : payment.method}:
                    </span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            ) : receiptData.paymentMethod && (
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="text-gray-600">Payment:</span>
                <span className="font-medium">{receiptData.paymentMethod}</span>
              </div>
            )}
            
            {/* Amount Tendered (what customer gave) */}
            {receiptData.amountTendered !== undefined && receiptData.amountTendered > receiptData.totalAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Tendered:</span>
                <span className="font-medium">{formatCurrency(receiptData.amountTendered)}</span>
              </div>
            )}
            
            {/* Change Due */}
            {receiptData.change !== undefined && receiptData.change > 0 && (
              <div className="flex justify-between text-sm font-bold text-green-600 bg-green-50 p-2 rounded mt-2">
                <span>CHANGE DUE:</span>
                <span>{formatCurrency(receiptData.change)}</span>
              </div>
            )}
            
            {/* Balance Due (for credit sales) */}
            {receiptData.balanceDue !== undefined && receiptData.balanceDue > 0 && (
              <div className="flex justify-between text-sm font-bold text-amber-700 bg-amber-50 p-2 rounded mt-2">
                <span>BALANCE DUE:</span>
                <span>{formatCurrency(receiptData.balanceDue)}</span>
              </div>
            )}
          </div>

          {/* Hidden receipt for printing */}
          <div className="hidden">
            <Receipt
              ref={receiptRef}
              saleNumber={receiptData.saleNumber}
              date={receiptData.saleDate}
              items={receiptData.items}
              subtotal={receiptData.subtotal}
              discountAmount={receiptData.discountAmount || 0}
              taxAmount={receiptData.taxAmount}
              total={receiptData.totalAmount}
              paymentMethod={receiptData.paymentMethod || 'CASH'}
              amountPaid={receiptData.amountPaid}
              amountTendered={receiptData.amountTendered}
              change={receiptData.change}
              balanceDue={receiptData.balanceDue}
              payments={receiptData.payments}
              customerName={receiptData.customerName}
              cashierName={receiptData.cashierName}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end border-t p-4 bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPrinting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          {printStatus === 'error' && (
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            autoFocus
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isPrinting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Printing...
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                Print Receipt
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
