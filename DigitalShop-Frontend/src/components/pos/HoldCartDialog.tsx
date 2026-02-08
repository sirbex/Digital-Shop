import { useState } from 'react';
import { Clock, X } from 'lucide-react';

interface HoldCartDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason?: string, notes?: string) => void;
    itemCount: number;
    totalAmount: number;
}

/**
 * Hold Cart Dialog
 * Allows user to put current cart on hold with optional reason
 */
export function HoldCartDialog({
    isOpen,
    onClose,
    onConfirm,
    itemCount,
    totalAmount,
}: HoldCartDialogProps) {
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    const handleConfirm = () => {
        onConfirm(reason || undefined, notes || undefined);
        setReason('');
        setNotes('');
    };

    const handleClose = () => {
        setReason('');
        setNotes('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        Put Cart on Hold
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4 py-4">
                    {/* Cart Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Items:</span>
                            <span className="font-medium">{itemCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Amount:</span>
                            <span className="font-medium">
                                UGX {totalAmount.toLocaleString()} 
                            </span>
                        </div>
                    </div>

                    {/* Reason (Optional) */}
                    <div className="space-y-2">
                        <label htmlFor="hold-reason" className="block text-sm font-medium text-gray-700">
                            Reason (Optional)
                        </label>
                        <input
                            id="hold-reason"
                            placeholder="e.g., Customer needs to get more money"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={255}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>

                    {/* Notes (Optional) */}
                    <div className="space-y-2">
                        <label htmlFor="hold-notes" className="block text-sm font-medium text-gray-700">
                            Notes (Optional)
                        </label>
                        <textarea
                            id="hold-notes"
                            placeholder="Additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                    </div>

                    {/* Info */}
                    <div className="text-xs text-gray-500 flex items-start gap-2">
                        <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>
                            This cart will be held for 24 hours. You can resume it anytime before expiration.
                        </span>
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={handleClose}
                        className="py-2 px-4 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="py-2 px-4 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center gap-2"
                    >
                        <Clock className="h-4 w-4" />
                        Hold Cart
                    </button>
                </div>
            </div>
        </div>
    );
}