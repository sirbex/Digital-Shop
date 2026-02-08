import React, { useState, useEffect } from 'react';
import { z } from 'zod';
import { CreatePurchaseOrderSchema, PurchaseOrderItem } from '@shared/zod/purchaseOrder';
import { productsApi, api } from '../../lib/api';

interface POFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof CreatePurchaseOrderSchema>) => Promise<void>;
}

export function POForm({ isOpen, onClose, onSubmit }: POFormProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      loadProducts();
      // Set default delivery date (7 days from now)
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setExpectedDeliveryDate(defaultDate.toISOString().split('T')[0]);
    }
  }, [isOpen]);

  const loadSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      if (response.data.success) {
        setSuppliers(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    }
  };

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

  const addItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        orderedQuantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        supplierId,
        orderDate: new Date().toISOString().split('T')[0],
        expectedDeliveryDate,
        notes: notes.trim() || undefined,
        items,
      };

      const validated = CreatePurchaseOrderSchema.parse(data);
      setIsSubmitting(true);
      await onSubmit(validated);

      // Reset form
      setSupplierId('');
      setExpectedDeliveryDate('');
      setNotes('');
      setItems([]);
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || 'Failed to create purchase order');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getProductInfo = (productId: string) => {
    return products.find(p => p.id === productId);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.orderedQuantity * item.unitPrice), 0);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-label="Supplier"
                title="Supplier"
              >
                <option value="">Select supplier...</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Expected Delivery Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                aria-label="Expected delivery date"
                title="Expected delivery date"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">
                Items <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addItem}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                + Add Item
              </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-right">Current Stock</th>
                    <th className="px-3 py-2 text-right">Quantity</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                        No items added. Click "Add Item" to begin.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const product = getProductInfo(item.productId);
                      return (
                        <tr key={index} className="border-t">
                          <td className="px-3 py-2">
                            <select
                              value={item.productId}
                              onChange={(e) => updateItem(index, 'productId', e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                              required
                              aria-label="Product"
                              title="Product"
                            >
                              <option value="">Select product...</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {product?.quantityOnHand || 0}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.orderedQuantity}
                              onChange={(e) => updateItem(index, 'orderedQuantity', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded"
                              min="0.01"
                              step="0.01"
                              required
                              aria-label="Quantity"
                              title="Quantity"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1 border rounded"
                              min="0"
                              aria-label="Unit price"
                              title="Unit price"
                              step="0.01"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {(item.orderedQuantity * item.unitPrice).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {items.length > 0 && (
              <div className="mt-2 text-right text-lg font-bold">
                Total: UGX {calculateTotal().toLocaleString()}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              maxLength={1000}
              placeholder="Any notes about this purchase order..."
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
              disabled={isSubmitting || items.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
