import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { CreateStockAdjustmentSchema } from '@shared/zod/stockAdjustment';
import { productsApi } from '../../lib/api';

interface StockAdjustmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof CreateStockAdjustmentSchema>) => Promise<void>;
  productId?: string; // Pre-select product if provided
}

const adjustmentTypes = [
  { value: 'DAMAGE', label: 'Damage' },
  { value: 'THEFT', label: 'Theft' },
  { value: 'EXPIRY', label: 'Expiry' },
  { value: 'COUNT_CORRECTION', label: 'Count Correction' },
  { value: 'OTHER', label: 'Other' },
];

export function StockAdjustmentForm({ isOpen, onClose, onSubmit, productId }: StockAdjustmentFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState(productId || '');
  const [quantityAdjusted, setQuantityAdjusted] = useState<number>(0);
  const [adjustmentType, setAdjustmentType] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      if (productId) {
        setSelectedProductId(productId);
      }
    }
  }, [isOpen, productId]);

  const loadProducts = async () => {
    try {
      const response = await productsApi.getAll();
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        productId: selectedProductId,
        quantityAdjusted,
        adjustmentType,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      };

      const validated = CreateStockAdjustmentSchema.parse(data);
      setIsSubmitting(true);
      await onSubmit(validated);

      // Reset form
      setSelectedProductId(productId || '');
      setQuantityAdjusted(0);
      setAdjustmentType('');
      setReason('');
      setNotes('');
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to create stock adjustment');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedProduct = products.find(p => p.id === selectedProductId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-xl">
        <h2 className="text-xl font-bold mb-4">Stock Adjustment</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Product <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!productId}
              aria-label="Product"
              title="Product"
            >
              <option value="">Select product...</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) - Current: {product.quantityOnHand}
                </option>
              ))}
            </select>
            {selectedProduct && (
              <p className="text-sm text-gray-600 mt-1">
                Current Stock: {selectedProduct.quantityOnHand} units
              </p>
            )}
          </div>

          {/* Quantity Adjusted */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Quantity Adjustment <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={quantityAdjusted}
              onChange={(e) => setQuantityAdjusted(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Positive for increase, negative for decrease"
              step="0.01"
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              {quantityAdjusted > 0 ? (
                <span className="text-green-600">+{quantityAdjusted} (Increase)</span>
              ) : quantityAdjusted < 0 ? (
                <span className="text-red-600">{quantityAdjusted} (Decrease)</span>
              ) : (
                <span>Enter adjustment amount</span>
              )}
              {selectedProduct && quantityAdjusted !== 0 && (
                <span className="ml-2">
                  → New Stock: {(parseFloat(selectedProduct.quantityOnHand) + quantityAdjusted).toFixed(2)}
                </span>
              )}
            </p>
          </div>

          {/* Adjustment Type */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Adjustment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              aria-label="Adjustment type"
              title="Adjustment type"
            >
              <option value="">Select type...</option>
              {adjustmentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief explanation for this adjustment"
              maxLength={500}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Additional Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              maxLength={1000}
              placeholder="Any additional details..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {notes.length}/1000 characters
            </p>
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
              disabled={isSubmitting || quantityAdjusted === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
