import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import POSButton from './POSButton';

interface PaymentLine {
  id: string;
  method: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT';
  amount: number;
  reference?: string;
}

interface SplitPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[]) => void;
  totalAmount: number;
  customerName?: string;
  hasCustomer: boolean;
}

export default function SplitPaymentDialog({
  isOpen,
  onClose,
  onConfirm,
  totalAmount,
  customerName,
  hasCustomer,
}: SplitPaymentDialogProps) {
  const [payments, setPayments] = useState<PaymentLine[]>([
    { id: '1', method: 'CASH', amount: totalAmount }
  ]);
  const [error, setError] = useState('');

  // Reset when dialog opens
  useEffect(() => {
    if (isOpen) {
      setPayments([{ id: '1', method: 'CASH', amount: totalAmount }]);
      setError('');
    }
  }, [isOpen, totalAmount]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;

  const addPaymentLine = () => {
    const newId = Date.now().toString();
    setPayments([...payments, { id: newId, method: 'CASH', amount: Math.max(0, remaining) }]);
  };

  const removePaymentLine = (id: string) => {
    if (payments.length <= 1) return;
    setPayments(payments.filter(p => p.id !== id));
  };

  const updatePayment = (id: string, updates: Partial<PaymentLine>) => {
    setPayments(payments.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  };

  const handleConfirm = () => {
    setError('');

    // Validate total
    if (totalPaid < totalAmount) {
      setError(`Payment total (UGX ${totalPaid.toLocaleString()}) is less than sale total (UGX ${totalAmount.toLocaleString()})`);
      return;
    }

    // Validate credit requires customer
    const hasCreditPayment = payments.some(p => p.method === 'CREDIT');
    if (hasCreditPayment && !hasCustomer) {
      setError('Credit payment requires a customer to be selected');
      return;
    }

    onConfirm(payments);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Split Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Close dialog" aria-label="Close dialog">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sale Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Sale Total</span>
            <span className="text-xl font-bold text-gray-900">UGX {totalAmount.toLocaleString()}</span>
          </div>
          {customerName && (
            <div className="text-sm text-gray-500 mt-1">Customer: {customerName}</div>
          )}
        </div>

        {/* Payment Lines */}
        <div className="space-y-3 mb-4">
          {payments.map((payment) => (
            <div key={payment.id} className="border rounded-lg p-3">
              <div className="flex items-center gap-3">
                {/* Payment Method */}
                <select
                  value={payment.method}
                  onChange={(e) => updatePayment(payment.id, { method: e.target.value as PaymentLine['method'] })}
                  className="flex-1 border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Select payment method"
                  title="Select payment method"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="CARD">💳 Card</option>
                  <option value="MOBILE_MONEY">📱 Mobile Money</option>
                  {hasCustomer && <option value="CREDIT">⏱️ Credit</option>}
                </select>

                {/* Amount */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">UGX</span>
                  <input
                    type="number"
                    value={payment.amount || ''}
                    onChange={(e) => updatePayment(payment.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="w-32 pl-12 pr-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                    min="0"
                    aria-label="Enter payment amount"
                    title="Enter payment amount"
                    step="100"
                  />
                </div>

                {/* Remove Button */}
                {payments.length > 1 && (
                  <button
                    onClick={() => removePaymentLine(payment.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove payment line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Reference field for Card/Mobile Money */}
              {(payment.method === 'CARD' || payment.method === 'MOBILE_MONEY') && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={payment.reference || ''}
                    onChange={(e) => updatePayment(payment.id, { reference: e.target.value })}
                    placeholder={payment.method === 'CARD' ? 'Card reference/last 4 digits' : 'Transaction ID'}
                    className="w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add Payment Line */}
        <button
          onClick={addPaymentLine}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2 mb-4"
        >
          <Plus className="w-4 h-4" />
          Add Payment Method
        </button>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Paid</span>
            <span className={`font-medium ${totalPaid >= totalAmount ? 'text-green-600' : 'text-gray-900'}`}>
              UGX {totalPaid.toLocaleString()}
            </span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Remaining</span>
              <span className="font-medium text-red-600">UGX {remaining.toLocaleString()}</span>
            </div>
          )}
          {remaining < 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Change Due</span>
              <span className="font-medium text-green-600">UGX {Math.abs(remaining).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <POSButton variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </POSButton>
          <POSButton 
            variant="success" 
            onClick={handleConfirm}
            disabled={totalPaid < totalAmount}
            className="flex-1"
          >
            Complete Sale
          </POSButton>
        </div>
      </div>
    </div>
  );
}
