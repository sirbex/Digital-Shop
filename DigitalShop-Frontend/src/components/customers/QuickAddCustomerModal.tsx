import { useState } from 'react';
import { customersApi } from '../../lib/api';
import POSModal from '../pos/POSModal';
import POSButton from '../pos/POSButton';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customer: any) => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  creditLimit: number;
}

export default function QuickAddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickAddCustomerModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    creditLimit: 500000, // Default: 500,000 UGX
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      creditLimit: 500000,
    });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Basic validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Customer name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.creditLimit < 0) {
      newErrors.creditLimit = 'Credit limit cannot be negative';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await customersApi.create({
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        creditLimit: formData.creditLimit,
      });

      if (response.data.success && response.data.data) {
        // Call success callback with created customer
        if (onSuccess) {
          onSuccess(response.data.data);
        }
        resetForm();
        onClose();
      } else {
        setErrors({ submit: response.data.error || 'Failed to create customer' });
      }
    } catch (error: any) {
      const message = error.response?.data?.error || error.message || 'Failed to create customer';
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <POSModal
      open={isOpen}
      onOpenChange={(open) => !open && handleCancel()}
      title="Quick Add Customer"
    >
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name - Required */}
          <div>
            <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              id="customer-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter customer name"
              autoFocus
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="customer-phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="+256 700 000 000"
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="customer-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="customer@example.com"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          {/* Address */}
          <div>
            <label htmlFor="customer-address" className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              id="customer-address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Physical address"
            />
          </div>

          {/* Credit Limit */}
          <div>
            <label htmlFor="customer-credit" className="block text-sm font-medium text-gray-700 mb-1">
              Credit Limit (UGX)
            </label>
            <input
              id="customer-credit"
              type="number"
              min="0"
              step="1000"
              value={formData.creditLimit}
              onChange={(e) => handleChange('creditLimit', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                errors.creditLimit ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="500000"
            />
            {errors.creditLimit && <p className="text-red-500 text-xs mt-1">{errors.creditLimit}</p>}
            
            {/* Quick set buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleChange('creditLimit', 100000)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                100K
              </button>
              <button
                type="button"
                onClick={() => handleChange('creditLimit', 250000)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                250K
              </button>
              <button
                type="button"
                onClick={() => handleChange('creditLimit', 500000)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                500K
              </button>
              <button
                type="button"
                onClick={() => handleChange('creditLimit', 1000000)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                1M
              </button>
              <button
                type="button"
                onClick={() => handleChange('creditLimit', 0)}
                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded"
              >
                No Credit
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">💡 Default: 500,000 UGX • Set to 0 for cash-only customers</p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 text-sm">{errors.submit}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <POSButton
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </POSButton>
            <POSButton
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Customer'}
            </POSButton>
          </div>
        </form>
      </div>
    </POSModal>
  );
}
