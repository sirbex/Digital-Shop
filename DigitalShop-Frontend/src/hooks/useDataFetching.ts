import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data fetching hook
 * Eliminates duplicate loading/error state management across 12+ pages
 */

interface UseDataFetchingOptions<T> {
  fetchFn: () => Promise<{ data: { success: boolean; data: T; error?: string } }>;
  initialData?: T;
  autoFetch?: boolean;
}

export function useDataFetching<T>({
  fetchFn,
  initialData,
  autoFetch = true,
}: UseDataFetchingOptions<T>) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetchFn();
      
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.error || 'Failed to fetch data');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
    setData,
  };
}
