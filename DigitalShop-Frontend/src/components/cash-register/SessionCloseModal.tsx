import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { CloseSessionSchema } from '@shared/zod/cashRegister';
import Decimal from 'decimal.js';
import { useSettings } from '../../contexts/SettingsContext';

interface SessionCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloseSession: (data: z.infer<typeof CloseSessionSchema>) => Promise<void>;
  session: any;
}

export function SessionCloseModal({ isOpen, onClose, onCloseSession, session }: SessionCloseModalProps) {
  const { settings } = useSettings();
  const cs = settings.currencySymbol;
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countedDenominations, setCountedDenominations] = useState({
    '50000': 0,
    '20000': 0,
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '200': 0,
    '100': 0,
  });

  // Calculate total from denominations
  useEffect(() => {
    const total = Object.entries(countedDenominations).reduce((sum, [denom, count]) => {
      return new Decimal(sum).plus(new Decimal(denom).times(count)).toNumber();
    }, 0);
    setClosingCash(total.toString());
  }, [countedDenominations]);

  const handleDenominationChange = (denomination: string, value: string) => {
    const count = parseInt(value) || 0;
    setCountedDenominations(prev => ({
      ...prev,
      [denomination]: count,
    }));
  };

  // Calculate expected cash
  const expectedCash = new Decimal(session?.openingFloat || 0)
    .plus(session?.totalCashSales || 0)
    .toNumber();

  const variance = closingCash 
    ? new Decimal(closingCash).minus(expectedCash).toNumber()
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        sessionId: session.id,
        closingCash: parseFloat(closingCash),
        notes: notes.trim() || undefined,
      };

      const validated = CloseSessionSchema.parse(data);
      setIsSubmitting(true);
      await onCloseSession(validated);
      
      // Reset form
      setClosingCash('');
      setNotes('');
      setCountedDenominations({
        '50000': 0, '20000': 0, '10000': 0, '5000': 0,
        '2000': 0, '1000': 0, '500': 0, '200': 0, '100': 0,
      });
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to close session');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
        <h2 className="text-xl font-bold mb-4">Close Cash Register Session</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Session Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium">Session Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Opening Float:</span>
                <span className="ml-2 font-medium">{cs} {session?.openingFloat?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Cash Sales:</span>
                <span className="ml-2 font-medium text-green-600">
                  {cs} {session?.totalCashSales?.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Total Card Sales:</span>
                <span className="ml-2 font-medium">{cs} {session?.totalCardSales?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Mobile Money:</span>
                <span className="ml-2 font-medium">{cs} {session?.totalMobileMoneySales?.toLocaleString()}</span>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-gray-600">Expected Cash:</span>
                <span className="ml-2 font-bold text-lg">{cs} {expectedCash.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Denomination Counter */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Count Cash Denominations
            </label>
            <div className="grid grid-cols-3 gap-3">
              {Object.keys(countedDenominations).map(denom => (
                <div key={denom} className="flex items-center gap-2">
                  <label className="text-sm w-24">{cs} {parseInt(denom).toLocaleString()}:</label>
                  <input
                    type="number"
                    min="0"
                    value={countedDenominations[denom as keyof typeof countedDenominations]}
                    onChange={(e) => handleDenominationChange(denom, e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    aria-label={`Count of ${denom} ${cs} notes`}
                    title={`Count of ${denom} ${cs} notes`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Closing Cash */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Total Closing Cash ({cs}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              aria-label="Closing cash amount"
              title="Closing cash amount"
            />
          </div>

          {/* Variance Alert */}
          {closingCash && (
            <div className={`p-4 rounded-lg ${
              Math.abs(variance) < 0.01 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="font-medium">Cash Variance:</span>
                <span className={`text-lg font-bold ${
                  variance > 0 ? 'text-green-600' : variance < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {variance >= 0 ? '+' : ''}{variance.toFixed(2)} {cs}
                </span>
              </div>
              {Math.abs(variance) >= 0.01 && (
                <p className="text-xs text-gray-600 mt-1">
                  {variance > 0 ? 'Overage' : 'Shortage'} detected. Manager approval may be required.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about closing the session, variances, or issues..."
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              maxLength={500}
            />
          </div>

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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Closing...' : 'Close Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
