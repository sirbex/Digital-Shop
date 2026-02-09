import React, { useState } from 'react';
import { z } from 'zod';
import { OpenSessionSchema } from '@shared/zod/cashRegister';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';

interface SessionOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSession: (data: z.infer<typeof OpenSessionSchema>) => Promise<void>;
}

export function SessionOpenModal({ isOpen, onClose, onOpenSession }: SessionOpenModalProps) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const cs = settings.currencySymbol;
  const [openingFloat, setOpeningFloat] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        userId: user?.id || '',
        openingFloat: parseFloat(openingFloat),
        notes: notes.trim() || undefined,
      };

      const validated = OpenSessionSchema.parse(data);
      setIsSubmitting(true);
      await onOpenSession(validated);
      
      // Reset form
      setOpeningFloat('');
      setNotes('');
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to open session');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Open Cash Register Session</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">
              Cashier
            </label>
            <input
              type="text"
              value={user?.fullName || ''}
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-gray-100"
              aria-label="Cashier name"
              title="Cashier name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Opening Float ({cs}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="e.g., 100000"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The starting cash amount in the drawer
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about opening the session..."
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
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Opening...' : 'Open Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
