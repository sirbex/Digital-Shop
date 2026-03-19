import { useState } from 'react';
import { suppliersApi } from '../../lib/api';
import { useSettings } from '../../contexts/SettingsContext';

const PAYMENT_METHODS = [
  { value: 'CASH', label: '💵 Cash' },
  { value: 'BANK_TRANSFER', label: '🏦 Bank Transfer' },
  { value: 'MOBILE_MONEY', label: '📱 Mobile Money' },
  { value: 'CARD', label: '💳 Card' },
];

interface RecordSupplierPaymentModalProps {
  supplier: { id: string; name: string; balance: number };
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordSupplierPaymentModal({ supplier, onClose, onSuccess }: RecordSupplierPaymentModalProps) {
  const { settings } = useSettings();
  const [amount, setAmount] = useState(supplier.balance.toString());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (parsedAmount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    if (parsedAmount > supplier.balance + 0.01) {
      setError(`Amount cannot exceed outstanding balance (${settings.currencySymbol} ${supplier.balance.toLocaleString()})`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await suppliersApi.recordPayment(supplier.id, {
        amount: parsedAmount,
        paymentMethod,
        paymentDate,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
      });

      if (response.data.success) {
        onSuccess();
      } else {
        setError(response.data.error || 'Failed to record payment');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg p-4 sm:p-6 max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Record Supplier Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Supplier Summary */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="text-sm text-orange-700 font-medium">{supplier.name}</div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm text-orange-600">Outstanding Balance:</span>
            <span className="text-lg font-bold text-orange-700">
              {settings.currencySymbol} {supplier.balance.toLocaleString()}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount ({settings.currencySymbol}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="100"
              max={supplier.balance}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
              required
              autoFocus
            />
            {parsedAmount > 0 && parsedAmount < supplier.balance && (
              <div className="text-xs text-gray-500 mt-1">
                Remaining after payment: {settings.currencySymbol} {(supplier.balance - parsedAmount).toLocaleString()}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    paymentMethod === method.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              title="Payment date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. Check #1234, Transfer ref..."
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment notes..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parsedAmount <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span> Processing...
                </>
              ) : (
                <>💰 Record Payment</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
