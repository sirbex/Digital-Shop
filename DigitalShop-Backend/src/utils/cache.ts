/**
 * Lightweight in-memory cache using node-cache.
 * 
 * Use this instead of Redis for single-instance deployments.
 * Provides automatic TTL expiration, stats tracking, and
 * namespaced key management.
 * 
 * Cache invalidation strategy:
 * - Settings:  bust on update (via cache.invalidateSettings())
 * - Dashboard: short TTL (60s), no manual invalidation needed
 * - Reports:   medium TTL (5 min), no manual invalidation needed
 * - Products:  bust on create/update/delete
 */

import NodeCache from 'node-cache';
import logger from './logger.js';

// --- Cache Instances ---
// Separate instances for different TTL strategies

/** Settings cache — long TTL, manually invalidated on update */
export const settingsCache = new NodeCache({
  stdTTL: 600,         // 10 minutes default
  checkperiod: 120,    // Cleanup every 2 min
  useClones: true,     // Return copies to prevent mutation
});

/** Dashboard/report cache — short TTL, auto-expires */
export const reportCache = new NodeCache({
  stdTTL: 60,          // 1 minute default for dashboard
  checkperiod: 30,
  useClones: true,
});

/** Product/inventory cache — medium TTL, invalidated on changes */
export const dataCache = new NodeCache({
  stdTTL: 120,         // 2 minutes default
  checkperiod: 60,
  useClones: true,
});

// --- Cache Keys ---
export const CacheKeys = {
  SYSTEM_SETTINGS: 'system:settings',
  DASHBOARD_SUMMARY: 'report:dashboard',
  SALES_SUMMARY: (start: string, end: string) => `report:sales-summary:${start}:${end}`,
  PROFIT_LOSS: (start: string, end: string) => `report:pnl:${start}:${end}`,
  CUSTOMER_AGING: 'report:customer-aging',
  STOCK_VALUATION: 'report:stock-valuation',
  STOCK_REORDER: 'report:stock-reorder',
  PRODUCT_SEARCH: (term: string) => `product:search:${term.toLowerCase().trim()}`,
} as const;

// --- Helper Functions ---

/**
 * Generic cache-aside pattern.
 * Tries cache first, falls back to fetcher, stores result.
 */
export async function cacheAside<T>(
  cache: NodeCache,
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const result = await fetcher();

  if (result !== null && result !== undefined) {
    if (ttl !== undefined) {
      cache.set(key, result, ttl);
    } else {
      cache.set(key, result);
    }
  }

  return result;
}

/**
 * Invalidate all settings-related cache entries.
 * Call after system settings are updated.
 */
export function invalidateSettings(): void {
  settingsCache.del(CacheKeys.SYSTEM_SETTINGS);
  logger.info('Cache: settings invalidated');
}

/**
 * Invalidate all report/dashboard cache entries.
 * Call after significant data changes (sales, payments, etc.).
 */
export function invalidateReports(): void {
  reportCache.flushAll();
  logger.info('Cache: reports invalidated');
}

/**
 * Invalidate product-related cache entries.
 * Call after product create/update/delete.
 */
export function invalidateProducts(): void {
  dataCache.flushAll();
  logger.info('Cache: product data invalidated');
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats() {
  return {
    settings: settingsCache.getStats(),
    reports: reportCache.getStats(),
    data: dataCache.getStats(),
  };
}

// Log cache events in development
if (process.env.NODE_ENV !== 'production') {
  settingsCache.on('set', (key) => logger.debug(`Cache SET [settings]: ${key}`));
  settingsCache.on('del', (key) => logger.debug(`Cache DEL [settings]: ${key}`));
  reportCache.on('set', (key) => logger.debug(`Cache SET [report]: ${key}`));
  dataCache.on('set', (key) => logger.debug(`Cache SET [data]: ${key}`));
}
