import React, { useState } from 'react';
import { z } from 'zod';
import { CreateCashMovementSchema } from '@shared/zod/cashRegister';

interface CashMovementFormProps {
  sessionId: string;
  onSubmit: (data: z.infer<typeof CreateCashMovementSchema>) => Promise<void>;
  onCancel: () => void;
}

export function CashMovementForm({ sessionId, onSubmit, onCancel }: CashMovementFormProps) {
  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_IN');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        sessionId,
        type,
        amount: parseFloat(amount),
        reason: reason.trim(),
      };

      const validated = CreateCashMovementSchema.parse(data);
      setIsSubmitting(true);
      await onSubmit(validated);
      
      // Reset form
      setAmount('');
      setReason('');
      setType('CASH_IN');
      onCancel();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to record cash movement');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <h3 className="font-medium">Record Cash Movement</h3>

      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={(e: any) => setType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            aria-label="Movement type"
            title="Movement type"
          >
            <option value="CASH_IN">Cash In (Adding money)</option>
            <option value="CASH_OUT">Cash Out (Removing money)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Amount (UGX) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 50000"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={type === 'CASH_IN' ? 'e.g., Bank deposit return' : 'e.g., Petty cash for supplies'}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            maxLength={500}
            required
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Recording...' : 'Record Movement'}
          </button>
        </div>
      </form>
    </div>
  );
}
