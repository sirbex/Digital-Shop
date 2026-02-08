import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface SystemSettingsRow {
  id: string;
  business_name: string;
  business_phone: string | null;
  business_email: string | null;
  business_address: string | null;
  currency_code: string;
  currency_symbol: string;
  date_format: string;
  time_format: string;
  timezone: string;
  tax_enabled: boolean;
  tax_name: string;
  tax_number: string | null;
  default_tax_rate: string;
  tax_inclusive: boolean;
  receipt_header_text: string | null;
  receipt_footer_text: string | null;
  receipt_show_tax_breakdown: boolean;
  receipt_auto_print: boolean;
  receipt_paper_width: number;
  low_stock_alerts_enabled: boolean;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface TableCount {
  table_name: string;
  row_count: number;
}

// ============================================================================
// Settings CRUD
// ============================================================================

/**
 * Get system settings (single row)
 */
export async function getSettings(pool: Pool): Promise<SystemSettingsRow | null> {
  try {
    const result = await pool.query<SystemSettingsRow>('SELECT * FROM system_settings LIMIT 1');
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get system settings', { error });
    throw error;
  }
}

/**
 * Update system settings (partial update)
 */
export async function updateSettings(
  pool: Pool,
  updates: Record<string, unknown>
): Promise<SystemSettingsRow> {
  // Build dynamic SET clause from the updates object
  const allowedColumns = [
    'business_name', 'business_phone', 'business_email', 'business_address',
    'currency_code', 'currency_symbol', 'date_format', 'time_format', 'timezone',
    'tax_enabled', 'tax_name', 'tax_number', 'default_tax_rate', 'tax_inclusive',
    'receipt_header_text', 'receipt_footer_text', 'receipt_show_tax_breakdown',
    'receipt_auto_print', 'receipt_paper_width',
    'low_stock_alerts_enabled', 'low_stock_threshold',
  ];

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedColumns.includes(key)) {
      setClauses.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }

  const query = `
    UPDATE system_settings
    SET ${setClauses.join(', ')}
    WHERE id = (SELECT id FROM system_settings LIMIT 1)
    RETURNING *
  `;

  try {
    const result = await pool.query<SystemSettingsRow>(query, values);
    if (result.rows.length === 0) {
      throw new Error('Settings row not found');
    }
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update system settings', { error });
    throw error;
  }
}

// ============================================================================
// Database Statistics
// ============================================================================

/**
 * Get record counts for all important tables
 */
export async function getTableCounts(pool: Pool): Promise<TableCount[]> {
  const query = `
    SELECT 
      relname AS table_name,
      GREATEST(n_live_tup, 0)::INTEGER AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY relname
  `;

  try {
    const result = await pool.query<TableCount>(query);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get table counts', { error });
    throw error;
  }
}

/**
 * Get database size
 */
export async function getDatabaseSize(pool: Pool): Promise<string> {
  try {
    const result = await pool.query(
      "SELECT pg_size_pretty(pg_database_size(current_database())) AS size"
    );
    return result.rows[0].size;
  } catch (error) {
    logger.error('Failed to get database size', { error });
    throw error;
  }
}

// ============================================================================
// Reset Operations
// ============================================================================

/**
 * Get exact counts for reset preview (uses COUNT for accuracy)
 */
export async function getResetPreviewCounts(pool: Pool): Promise<{
  transactional: Record<string, number>;
  master: Record<string, number>;
}> {
  const transactionalTables = [
    'sales', 'sale_items', 'invoices', 'invoice_payments',
    'purchase_orders', 'purchase_order_items',
    'goods_receipts', 'goods_receipt_items',
    'stock_movements', 'inventory_batches', 'cost_layers',
    'cash_register_sessions', 'cash_movements',
    'pos_held_orders', 'pos_held_order_items',
  ];

  const masterTables = [
    'users', 'products', 'customers', 'suppliers',
    'customer_groups', 'cash_registers', 'pricing_tiers',
  ];

  // Check for optional tables
  const optionalTables = ['expenses', 'expense_categories', 'refunds', 'refund_items'];
  const existingOptional: string[] = [];
  for (const table of optionalTables) {
    try {
      const check = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [table]
      );
      if (check.rows[0].exists) {
        existingOptional.push(table);
      }
    } catch {
      // Skip tables that don't exist
    }
  }

  const transactional: Record<string, number> = {};
  const master: Record<string, number> = {};

  // Count transactional tables
  for (const table of [...transactionalTables, ...existingOptional.filter(t => !['expense_categories'].includes(t))]) {
    try {
      const result = await pool.query(`SELECT COUNT(*)::INTEGER AS count FROM ${table}`);
      transactional[table] = result.rows[0].count;
    } catch {
      // Table might not exist, skip
    }
  }

  // Count master tables
  for (const table of [...masterTables, ...existingOptional.filter(t => t === 'expense_categories')]) {
    try {
      const result = await pool.query(`SELECT COUNT(*)::INTEGER AS count FROM ${table}`);
      master[table] = result.rows[0].count;
    } catch {
      // Table might not exist, skip
    }
  }

  return { transactional, master };
}

/**
 * Execute full transaction reset
 * Deletes all transactional data while preserving master data
 */
export async function executeReset(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Order matters due to foreign key constraints.
    // Use TRUNCATE CASCADE for efficiency and safety.
    // Child tables first, then parent tables.

    // 1. Delete cash movements (child of sessions)
    await client.query('TRUNCATE TABLE cash_movements CASCADE');

    // 2. Delete POS held orders
    await client.query('TRUNCATE TABLE pos_held_order_items CASCADE');
    await client.query('TRUNCATE TABLE pos_held_orders CASCADE');

    // 3. Delete sale-related
    await client.query('TRUNCATE TABLE invoice_payments CASCADE');
    await client.query('TRUNCATE TABLE invoices CASCADE');
    await client.query('TRUNCATE TABLE sale_items CASCADE');
    await client.query('TRUNCATE TABLE sales CASCADE');

    // 4. Delete purchase-related
    await client.query('TRUNCATE TABLE goods_receipt_items CASCADE');
    await client.query('TRUNCATE TABLE goods_receipts CASCADE');
    await client.query('TRUNCATE TABLE purchase_order_items CASCADE');
    await client.query('TRUNCATE TABLE purchase_orders CASCADE');

    // 5. Delete inventory tracking
    await client.query('TRUNCATE TABLE stock_movements CASCADE');
    await client.query('TRUNCATE TABLE inventory_batches CASCADE');
    await client.query('TRUNCATE TABLE cost_layers CASCADE');

    // 6. Delete cash register sessions
    await client.query('TRUNCATE TABLE cash_register_sessions CASCADE');

    // 7. Delete optional tables (expenses, refunds)
    const optionalTables = ['refund_items', 'refunds', 'expenses'];
    for (const table of optionalTables) {
      try {
        await client.query(`TRUNCATE TABLE ${table} CASCADE`);
      } catch {
        // Table might not exist, skip
      }
    }

    // 8. Reset balances on master data
    await client.query('UPDATE customers SET balance = 0, updated_at = CURRENT_TIMESTAMP');
    await client.query('UPDATE suppliers SET balance = 0, updated_at = CURRENT_TIMESTAMP');
    await client.query(`
      UPDATE products SET 
        quantity_on_hand = 0, 
        average_cost = 0, 
        last_cost = 0,
        updated_at = CURRENT_TIMESTAMP
    `);

    // 9. Reset sequences used for hold numbers
    await client.query("SELECT setval('hold_number_seq', 1, false)");

    await client.query('COMMIT');
    logger.info('System reset completed successfully - all transactional data cleared');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('System reset failed', { error });
    throw error;
  } finally {
    client.release();
  }
}
