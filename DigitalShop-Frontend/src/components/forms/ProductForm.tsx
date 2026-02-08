import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { CreateProductSchema, UpdateProductSchema, type CreateProduct } from '@shared/zod/product';
import { productsApi } from '@/lib/api';

// Combobox component that allows both dropdown selection and free text
function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  id: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAllOptions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show all options when dropdown button clicked, otherwise filter
  const displayOptions = showAllOptions 
    ? options 
    : options.filter((opt) => opt.toLowerCase().includes(inputValue.toLowerCase()));

  const handleDropdownClick = () => {
    if (isOpen) {
      setIsOpen(false);
      setShowAllOptions(false);
    } else {
      setIsOpen(true);
      setShowAllOptions(true); // Show all options when clicking dropdown button
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex">
        <input
          type="text"
          id={id}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
            setShowAllOptions(false); // Filter when typing
          }}
          onFocus={() => {
            setIsOpen(true);
            setShowAllOptions(false);
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={handleDropdownClick}
          className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 focus:outline-none"
          title="Toggle dropdown"
          aria-label="Toggle dropdown"
        >
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {isOpen && displayOptions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {displayOptions.map((opt) => (
            <li
              key={opt}
              onClick={() => {
                setInputValue(opt);
                onChange(opt);
                setIsOpen(false);
                setShowAllOptions(false);
              }}
              className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ProductFormProps {
  product?: any; // Existing product for edit mode
  categories?: string[]; // Existing categories for dropdown
  unitsOfMeasure?: string[]; // Existing UOMs for dropdown
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, categories = [], unitsOfMeasure = [], onSuccess, onCancel }: ProductFormProps) {
  const isEditMode = !!product;
  
  // Default UOMs if none provided
  const defaultUOMs = ['PCS', 'KG', 'G', 'L', 'ML', 'M', 'CM', 'BOX', 'PACK', 'DOZEN', 'PAIR', 'SET'];
  const allUOMs = [...new Set([...defaultUOMs, ...unitsOfMeasure])].sort();
  
  // Default categories - merge with passed categories
  const defaultCategories = ['Beverages', 'Groceries', 'Dairy', 'Bakery', 'Snacks', 'Personal Care', 'Household', 'Electronics'];
  const allCategories = [...new Set([...defaultCategories, ...categories])].sort();
  
  const [formData, setFormData] = useState<Partial<CreateProduct>>({
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    unitOfMeasure: product?.unitOfMeasure || 'PCS',
    conversionFactor: product?.conversionFactor || 1.0,
    costPrice: product?.costPrice || 0,
    sellingPrice: product?.sellingPrice || 0,
    costingMethod: product?.costingMethod || 'FIFO',
    reorderLevel: product?.reorderLevel || 0,
    trackExpiry: product?.trackExpiry || false,
    isTaxable: product?.isTaxable !== undefined ? product.isTaxable : true,
    taxRate: product?.taxRate || 0.06,
    isActive: product?.isActive !== undefined ? product.isActive : true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (field: keyof CreateProduct, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setApiError('');
    setIsSubmitting(true);

    try {
      // Validate with shared Zod schema
      const schema = isEditMode ? UpdateProductSchema : CreateProductSchema;
      const validated = schema.parse(formData);

      // Submit to API
      if (isEditMode) {
        await productsApi.update(product.id, validated);
      } else {
        await productsApi.create(validated as CreateProduct);
      }

      onSuccess();
    } catch (error: any) {
      // DEBUG: Log the error
      console.error('[ProductForm] Error:', error);
      if (error instanceof z.ZodError) {
        // Map Zod errors to form fields
        const fieldErrors: Record<string, string> = {};
        error.issues.forEach(issue => {
          const field = issue.path[0] as string;
          fieldErrors[field] = issue.message;
        });
        setErrors(fieldErrors);
      } else if (error?.response?.data?.error) {
        // API returned error - show the actual message
        setApiError(error.response.data.error);
      } else if (error instanceof Error) {
        setApiError(error.message);
      } else {
        setApiError('Failed to save product');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditMode ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            type="button"
            title="Close form"
            aria-label="Close form"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          {apiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SKU */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SKU <span className="text-gray-400 text-xs">(auto-generated if empty)</span>
              </label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.sku ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Leave empty to auto-generate (PRD-00001)"
              />
              {errors.sku && <p className="mt-1 text-sm text-red-600">{errors.sku}</p>}
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode || ''}
                onChange={(e) => handleChange('barcode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>

            {/* Product Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Product name"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional product description"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <ComboboxInput
                id="category"
                value={formData.category || ''}
                onChange={(val) => handleChange('category', val)}
                options={allCategories}
                placeholder="Select or type a category"
              />
            </div>

            {/* Unit of Measure */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure</label>
              <ComboboxInput
                id="uom"
                value={formData.unitOfMeasure || 'PCS'}
                onChange={(val) => handleChange('unitOfMeasure', val)}
                options={allUOMs}
                placeholder="Select or type a UOM"
              />
            </div>

            {/* Cost Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.costPrice}
                onChange={(e) => handleChange('costPrice', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.costPrice ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-label="Cost price"
                title="Cost price"
              />
              {errors.costPrice && <p className="mt-1 text-sm text-red-600">{errors.costPrice}</p>}
            </div>

            {/* Selling Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Selling Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.sellingPrice}
                onChange={(e) => handleChange('sellingPrice', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.sellingPrice ? 'border-red-500' : 'border-gray-300'
                }`}
                aria-label="Selling price"
                title="Selling price"
              />
              {errors.sellingPrice && <p className="mt-1 text-sm text-red-600">{errors.sellingPrice}</p>}
            </div>

            {/* Costing Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Costing Method</label>
              <select
                value={formData.costingMethod}
                onChange={(e) => handleChange('costingMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"                aria-label="Costing method"
                title="Costing method"              >
                <option value="FIFO">FIFO (First In, First Out)</option>
                <option value="AVCO">AVCO (Average Cost)</option>
                <option value="STANDARD">Standard Cost</option>
              </select>
            </div>

            {/* Reorder Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorderLevel}
                onChange={(e) => handleChange('reorderLevel', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Minimum stock level"
              />
            </div>

            {/* Checkboxes */}
            <div className="md:col-span-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.trackExpiry}
                  onChange={(e) => handleChange('trackExpiry', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Track Expiry Dates</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isTaxable}
                  onChange={(e) => handleChange('isTaxable', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Taxable Product</span>
              </label>

              {/* Tax Rate - only show when Taxable is checked */}
              {formData.isTaxable && (
                <div className="ml-6 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={(formData.taxRate || 0) * 100}
                    aria-label="Tax rate percentage"
                    title="Tax rate percentage"
                    onChange={(e) => handleChange('taxRate', parseFloat(e.target.value) / 100 || 0)}
                    className={`w-32 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.taxRate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.taxRate && <p className="mt-1 text-sm text-red-500">{errors.taxRate}</p>}
                </div>
              )}

              {isEditMode && (
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active Product</span>
                </label>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
