import { useState, useCallback, useMemo } from 'react';

/**
 * Generic filtering hook
 * Eliminates duplicate filter logic across pages
 */

export type FilterFn<T> = (item: T, query: string) => boolean;

interface UseFilterOptions<T> {
  data: T[];
  filterFn: FilterFn<T>;
}

export function useFilter<T>({ data, filterFn }: UseFilterOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }
    return data.filter((item) => filterFn(item, searchQuery.toLowerCase()));
  }, [data, searchQuery, filterFn]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    searchQuery,
    filteredData,
    handleSearch,
    clearSearch,
  };
}
