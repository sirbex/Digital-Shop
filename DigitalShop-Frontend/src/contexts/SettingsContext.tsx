import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import Decimal from 'decimal.js';
import { systemApi } from '../lib/api';

// ============================================================================
// System Settings Interface
// ============================================================================
export interface SystemSettings {
  id: string;
  businessName: string;
  businessPhone: string | null;
  businessEmail: string | null;
  businessAddress: string | null;
  currencyCode: string;
  currencySymbol: string;
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  taxEnabled: boolean;
  taxName: string;
  taxNumber: string | null;
  defaultTaxRate: number;
  taxInclusive: boolean;
  receiptHeaderText: string | null;
  receiptFooterText: string | null;
  receiptShowTaxBreakdown: boolean;
  receiptAutoPrint: boolean;
  receiptPaperWidth: number;
  lowStockAlertsEnabled: boolean;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Default Settings (fallback while loading)
// ============================================================================
const DEFAULT_SETTINGS: SystemSettings = {
  id: '',
  businessName: 'DigitalShop',
  businessPhone: null,
  businessEmail: null,
  businessAddress: null,
  currencyCode: 'UGX',
  currencySymbol: 'UGX',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  timezone: 'Africa/Kampala',
  taxEnabled: true,
  taxName: 'VAT',
  taxNumber: null,
  defaultTaxRate: 18,
  taxInclusive: true,
  receiptHeaderText: null,
  receiptFooterText: null,
  receiptShowTaxBreakdown: true,
  receiptAutoPrint: false,
  receiptPaperWidth: 80,
  lowStockAlertsEnabled: true,
  lowStockThreshold: 10,
  createdAt: '',
  updatedAt: '',
};

// ============================================================================
// Context Type
// ============================================================================
interface SettingsContextType {
  settings: SystemSettings;
  isLoading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setError(null);
      const response = await systemApi.getPublicSettings();
      if (response.data?.success && response.data?.data) {
        setSettings(response.data.data);
      }
    } catch (err: any) {
      // Non-blocking: keep defaults if settings fail to load
      console.warn('Failed to load system settings, using defaults:', err?.message);
      setError(err?.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if user is authenticated (token exists)
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [fetchSettings]);

  // Listen for auth changes to refetch settings
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' && e.newValue) {
        fetchSettings();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchSettings]);

  // Currency formatter using settings
  const formatCurrency = useCallback(
    (amount: number | string | null | undefined): string => {
      if (amount === null || amount === undefined) return `${settings.currencySymbol} 0`;
      const d = new Decimal(amount || 0);
      return `${settings.currencySymbol} ${d.toNumber().toLocaleString('en-UG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    },
    [settings.currencySymbol]
  );

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      error,
      refreshSettings: fetchSettings,
      formatCurrency,
    }),
    [settings, isLoading, error, fetchSettings, formatCurrency]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================
export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

/**
 * Standalone formatCurrency that uses current settings from localStorage cache.
 * Use this in utility functions outside of React components.
 * For components, prefer useSettings().formatCurrency instead.
 */
export function formatCurrencyWithSymbol(
  amount: number | string | null | undefined,
  symbol: string = 'UGX'
): string {
  if (amount === null || amount === undefined) return `${symbol} 0`;
  const d = new Decimal(amount || 0);
  return `${symbol} ${d.toNumber().toLocaleString('en-UG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
