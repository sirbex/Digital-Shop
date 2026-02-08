import React, { useState } from 'react';
import { z } from 'zod';
import { VoidSaleSchema } from '@shared/zod/saleRefund';

interface VoidSaleButtonProps {
  sale: any;
  onVoid: (data: z.infer<typeof VoidSaleSchema>) => Promise<void>;
}

const voidReasons = [
  { value: 'CUSTOMER_CANCELLED', label: 'Customer Cancelled' },
  { value: 'PAYMENT_FAILED', label: 'Payment Failed' },
  { value: 'DUPLICATE_TRANSACTION', label: 'Duplicate Transaction' },
  { value: 'PRICING_ERROR', label: 'Pricing Error' },
  { value: 'SYSTEM_ERROR', label: 'System Error' },
  { value: 'OTHER', label: 'Other' },
];

export function VoidSaleButton({ sale, onVoid }: VoidSaleButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        saleId: sale.id,
        voidReason: voidReason as any,
        notes: notes.trim(),
      };

      const validated = VoidSaleSchema.parse(data);
      setIsSubmitting(true);
      await onVoid(validated);

      // Reset and close
      setVoidReason('');
      setNotes('');
      setIsModalOpen(false);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to void sale');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sale.status === 'VOIDED' || sale.status === 'VOID') {
    return (
      <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-500 border border-gray-200">
        Voided
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
        title="Void this sale"
      >
        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Void
      </button>

      {/* Void Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-red-600">Void Sale</h2>

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Voiding this sale will:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                <li>Mark the sale as VOIDED</li>
                <li>Restore inventory to stock</li>
                <li>Update customer balance (if credit sale)</li>
                <li>This action cannot be undone</li>
              </ul>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm"><strong>Sale #:</strong> {sale.saleNumber}</p>
              <p className="text-sm"><strong>Customer:</strong> {sale.customerName || 'Walk-in'}</p>
              <p className="text-sm"><strong>Amount:</strong> UGX {parseFloat(sale.totalAmount).toLocaleString()}</p>
            </div>

            <form onSubmit={handleVoid} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Void Reason */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Void Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  aria-label="Void reason"
                  title="Void reason"
                >
                  <option value="">Select reason...</option>
                  {voidReasons.map(reason => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  maxLength={500}
                  placeholder="Explain why this sale is being voided..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  {notes.length}/500 characters (minimum 3)
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setVoidReason('');
                    setNotes('');
                    setError('');
                  }}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || notes.trim().length < 3}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? 'Voiding...' : 'Void Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
