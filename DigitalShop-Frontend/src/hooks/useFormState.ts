import { useState, useCallback } from 'react';

/**
 * Generic form state management hook
 * Eliminates duplicate form state patterns across 80+ components
 */

interface UseFormStateOptions<T> {
  initialData: T;
  onSubmit: (data: T) => Promise<void>;
  onSuccess?: () => void;
}

export function useFormState<T extends Record<string, any>>({
  initialData,
  onSubmit,
  onSuccess,
}: UseFormStateOptions<T>) {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = useCallback((field: keyof T, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user types
    if (errors[field as string]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  const resetForm = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setApiError('');
    setIsSubmitting(false);
  }, [initialData]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setErrors({});
    setApiError('');
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onSuccess?.();
      resetForm();
    } catch (error: any) {
      if (error.response?.data?.details) {
        // Zod validation errors
        const fieldErrors: Record<string, string> = {};
        error.response.data.details.forEach((detail: any) => {
          fieldErrors[detail.field] = detail.message;
        });
        setErrors(fieldErrors);
      } else {
        setApiError(error.response?.data?.error || error.message || 'An error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, onSuccess, resetForm]);

  return {
    formData,
    setFormData,
    errors,
    apiError,
    isSubmitting,
    handleChange,
    handleSubmit,
    resetForm,
  };
}
