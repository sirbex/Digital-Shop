import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { CreateRefundSchema } from '@shared/zod/saleRefund';
import Decimal from 'decimal.js';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  onSubmit: (data: z.infer<typeof CreateRefundSchema>) => Promise<void>;
}

const refundReasons = [
  { value: 'CUSTOMER_REQUEST', label: 'Customer Request' },
  { value: 'DAMAGED_PRODUCT', label: 'Damaged Product' },
  { value: 'WRONG_PRODUCT', label: 'Wrong Product' },
  { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { value: 'PRICING_ERROR', label: 'Pricing Error' },
  { value: 'OTHER', label: 'Other' },
];

export function RefundModal({ isOpen, onClose, sale, onSubmit }: RefundModalProps) {
  const [refundType, setRefundType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [refundReason, setRefundReason] = useState('');
  const [returnToInventory, setReturnToInventory] = useState(true);
  const [notes, setNotes] = useState('');
  const [itemRefunds, setItemRefunds] = useState<Record<string, { quantity: number; amount: number }>>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && sale) {
      // Initialize full refund by default
      const initialRefunds: Record<string, { quantity: number; amount: number }> = {};
      sale.items?.forEach((item: any) => {
        // Handle both camelCase and snake_case field names with fallback
        const totalAmount = item.totalAmount || item.total_price || (item.unitPrice * item.quantity) || 0;
        initialRefunds[item.id] = {
          quantity: parseFloat(item.quantity) || 0,
          amount: parseFloat(totalAmount) || 0,
        };
      });
      setItemRefunds(initialRefunds);
    }
  }, [isOpen, sale]);

  const handleItemQuantityChange = (itemId: string, quantity: number) => {
    const item = sale.items?.find((i: any) => i.id === itemId);
    if (!item) return;

    const maxQty = parseFloat(item.quantity) || 1;
    const actualQty = Math.min(Math.max(0, quantity), maxQty);

    // Calculate refund amount proportionally (handle both camelCase and snake_case)
    const totalAmount = item.totalAmount || item.total_price || (item.unitPrice * item.quantity) || 0;
    const unitPrice = new Decimal(totalAmount).div(maxQty);
    const refundAmount = unitPrice.times(actualQty).toNumber();

    setItemRefunds(prev => ({
      ...prev,
      [itemId]: { quantity: actualQty, amount: refundAmount },
    }));
  };

  const calculateTotalRefund = () => {
    return Object.values(itemRefunds).reduce((sum, item) => sum + item.amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const items = Object.entries(itemRefunds)
        .filter(([_, data]) => data.quantity > 0)
        .map(([saleItemId, data]) => ({
          saleItemId,
          quantityToRefund: data.quantity,
          refundAmount: data.amount,
        }));

      if (items.length === 0) {
        setError('Please select at least one item to refund');
        return;
      }

      const data = {
        saleId: sale.id,
        refundType,
        refundReason: refundReason as any,
        items,
        returnToInventory,
        refundAmount: calculateTotalRefund(),
        notes: notes.trim() || undefined,
      };

      const validated = CreateRefundSchema.parse(data);
      setIsSubmitting(true);
      await onSubmit(validated);

      // Reset form
      setRefundType('FULL');
      setRefundReason('');
      setReturnToInventory(true);
      setNotes('');
      setItemRefunds({});
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to process refund');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !sale) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-2 sm:p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-3xl my-4 sm:my-8 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Process Refund</h2>

        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm"><strong>Sale #:</strong> {sale.saleNumber}</p>
          <p className="text-sm"><strong>Customer:</strong> {sale.customerName || 'Walk-in'}</p>
          <p className="text-sm"><strong>Total Amount:</strong> UGX {parseFloat(sale.totalAmount).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Refund Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Refund Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="FULL"
                  checked={refundType === 'FULL'}
                  onChange={(e) => setRefundType(e.target.value as 'FULL')}
                  className="mr-2"
                />
                Full Refund
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="PARTIAL"
                  checked={refundType === 'PARTIAL'}
                  onChange={(e) => setRefundType(e.target.value as 'PARTIAL')}
                  className="mr-2"
                />
                Partial Refund
              </label>
            </div>
          </div>

          {/* Refund Reason */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Refund Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              required
              aria-label="Refund reason"
              title="Refund reason"
            >
              <option value="">Select reason...</option>
              {refundReasons.map(reason => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {/* Items to Refund */}
          <div>
            <label className="block text-sm font-medium mb-2">Items to Refund</label>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Sold Qty</th>
                    <th className="px-3 py-2 text-right">Refund Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Refund Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((item: any) => {
                    const refundData = itemRefunds[item.id] || { quantity: 0, amount: 0 };
                    // Handle null/undefined totalAmount with fallback calculation
                    const totalAmount = item.totalAmount || item.total_price || (item.unitPrice * item.quantity) || 0;
                    const qty = parseFloat(item.quantity) || 1;
                    const unitPrice = new Decimal(totalAmount).div(qty).toNumber();

                    return (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{item.productName}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={refundData.quantity}
                            onChange={(e) => handleItemQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border rounded text-right"
                            min="0"
                            aria-label="Refund quantity"
                            title="Refund quantity"
                            max={item.quantity}
                            step="0.01"
                            disabled={refundType === 'FULL'}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">{unitPrice.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {refundData.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50 font-bold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right">Total Refund:</td>
                    <td className="px-3 py-2 text-right">
                      UGX {calculateTotalRefund().toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Return to Inventory */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={returnToInventory}
                onChange={(e) => setReturnToInventory(e.target.checked)}
                className="mr-2"
              />
              Return items to inventory
            </label>
            <p className="text-xs text-gray-500 ml-6">
              If checked, refunded items will be added back to stock
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              maxLength={500}
              placeholder="Any additional notes about this refund..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || calculateTotalRefund() === 0}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : `Process Refund (UGX ${calculateTotalRefund().toLocaleString()})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
