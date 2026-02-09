import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';
import * as systemRepository from './systemRepository.js';
import { settingsCache, CacheKeys, cacheAside, invalidateSettings } from '../../utils/cache.js';

// ============================================================================
// Types (camelCase for API)
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

export interface DatabaseStats {
  databaseSize: string;
  masterData: Record<string, number>;
  transactionalData: Record<string, number>;
  totalRecords: number;
}

export interface ResetPreview {
  willBeCleared: {
    transactionalData: Record<string, number>;
    totalRecords: number;
  };
  willBePreserved: {
    masterData: Record<string, number>;
  };
}

// ============================================================================
// Converters
// ============================================================================

function toSettings(row: systemRepository.SystemSettingsRow): SystemSettings {
  return {
    id: row.id,
    businessName: row.business_name,
    businessPhone: row.business_phone,
    businessEmail: row.business_email,
    businessAddress: row.business_address,
    currencyCode: row.currency_code,
    currencySymbol: row.currency_symbol,
    dateFormat: row.date_format,
    timeFormat: row.time_format,
    timezone: row.timezone,
    taxEnabled: row.tax_enabled,
    taxName: row.tax_name,
    taxNumber: row.tax_number,
    defaultTaxRate: parseFloat(row.default_tax_rate),
    taxInclusive: row.tax_inclusive,
    receiptHeaderText: row.receipt_header_text,
    receiptFooterText: row.receipt_footer_text,
    receiptShowTaxBreakdown: row.receipt_show_tax_breakdown,
    receiptAutoPrint: row.receipt_auto_print,
    receiptPaperWidth: row.receipt_paper_width,
    lowStockAlertsEnabled: row.low_stock_alerts_enabled,
    lowStockThreshold: row.low_stock_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert camelCase keys to snake_case for DB updates
 */
function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get system settings (cached — 10 min TTL, invalidated on update)
 */
export async function getSettings(pool: Pool): Promise<SystemSettings> {
  return cacheAside(settingsCache, CacheKeys.SYSTEM_SETTINGS, async () => {
    const row = await systemRepository.getSettings(pool);
    if (!row) {
      throw new Error('System settings not found. Please run the migration script.');
    }
    return toSettings(row);
  });
}

/**
 * Update system settings (accepts camelCase, converts to snake_case)
 */
export async function updateSettings(
  pool: Pool,
  updates: Partial<SystemSettings>
): Promise<SystemSettings> {
  // Remove read-only fields
  const { id, createdAt, updatedAt, ...writableUpdates } = updates as any;

  const snakeUpdates = camelToSnake(writableUpdates);
  const row = await systemRepository.updateSettings(pool, snakeUpdates);
  invalidateSettings();
  return toSettings(row);
}

/**
 * Get database statistics for overview
 */
export async function getDatabaseStats(pool: Pool): Promise<DatabaseStats> {
  const [tableCounts, databaseSize] = await Promise.all([
    systemRepository.getTableCounts(pool),
    systemRepository.getDatabaseSize(pool),
  ]);

  const masterTables = new Set([
    'users', 'products', 'customers', 'suppliers',
    'customer_groups', 'cash_registers', 'pricing_tiers',
    'expense_categories', 'system_settings',
  ]);

  const masterData: Record<string, number> = {};
  const transactionalData: Record<string, number> = {};
  let totalRecords = 0;

  for (const { table_name, row_count } of tableCounts) {
    totalRecords += row_count;
    if (masterTables.has(table_name)) {
      masterData[table_name] = row_count;
    } else {
      transactionalData[table_name] = row_count;
    }
  }

  return {
    databaseSize,
    masterData,
    transactionalData,
    totalRecords,
  };
}

/**
 * Get reset preview (exact counts)
 */
export async function getResetPreview(pool: Pool): Promise<ResetPreview> {
  const { transactional, master } = await systemRepository.getResetPreviewCounts(pool);

  const totalRecords = Object.values(transactional).reduce((a, b) => a + b, 0);

  return {
    willBeCleared: {
      transactionalData: transactional,
      totalRecords,
    },
    willBePreserved: {
      masterData: master,
    },
  };
}

/**
 * Execute system reset with validation
 */
export async function executeReset(
  pool: Pool,
  confirmText: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  // Validate confirmation phrase
  if (confirmText !== 'RESET ALL TRANSACTIONS') {
    throw new Error('Invalid confirmation phrase');
  }

  // Validate reason
  if (!reason || reason.length < 10) {
    throw new Error('Please provide a detailed reason (minimum 10 characters)');
  }

  logger.warn('System reset initiated', { reason });

  await systemRepository.executeReset(pool);

  logger.info('System reset completed', { reason });

  return {
    success: true,
    message: 'All transactional data has been cleared. Master data preserved.',
  };
}
