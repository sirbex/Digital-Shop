/**
 * Startup Migration Runner
 * Executes incremental SQL migration files on server start.
 * All migrations must be idempotent (safe to re-run).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ordered list of migration files to run after the base schema (01 + 02 + 03)
const MIGRATION_FILES = [
  '05_add_refunds_tables.sql',
  '05_expenses.sql',
  '05_rbac_roles_permissions.sql',
  '06_system_settings.sql',
  '07_custom_sale_items.sql',
  '08_supplier_payments.sql',
  '09_check_payments.sql',
  '10_quotations.sql',
  'fix_po_status.sql',
  'fix_profit_discount.sql',
  'fix_seed.sql',
  'fix_updated_at.sql',
];

export async function runMigrations(pool: Pool): Promise<void> {
  // Resolve path to SQL directory (works from both src/ and dist/)
  const sqlDir = path.resolve(__dirname, '../../../DigitalShop-Shared/sql');

  if (!fs.existsSync(sqlDir)) {
    logger.warn(`Migration SQL directory not found at ${sqlDir}, skipping migrations`);
    return;
  }

  logger.info('Running startup migrations...');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(sqlDir, file);

    if (!fs.existsSync(filePath)) {
      logger.warn(`Migration file not found: ${file}, skipping`);
      continue;
    }

    try {
      const sql = fs.readFileSync(filePath, 'utf-8');
      await pool.query(sql);
      logger.info(`Migration applied: ${file}`);
    } catch (error: any) {
      // Log but don't crash — some may partially fail on edge cases
      logger.error(`Migration failed: ${file} — ${error.message}`);
    }
  }

  logger.info('Startup migrations complete');
}
