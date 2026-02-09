import Decimal from 'decimal.js';

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Format a number as currency.
 * Accepts an optional currency symbol (defaults to 'UGX').
 * For React components, prefer useSettings().formatCurrency which auto-reads settings.
 */
export const formatCurrency = (amount: number | string | null | undefined, currencySymbol: string = 'UGX'): string => {
  if (amount === null || amount === undefined) return `${currencySymbol} 0`;
  
  const d = new Decimal(amount || 0);
  return `${currencySymbol} ${d.toNumber().toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format date for display without timezone conversion
 * Backend returns DATE as YYYY-MM-DD string (no timezone)
 * Frontend displays as-is without parsing to Date object
 */
export const formatDisplayDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';

  // If it's an ISO string, extract the date part
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }

  return dateString;
};
