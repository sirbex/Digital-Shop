import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

export interface SaleRow {
  id: string;
  sale_number: string;
  customer_id: string | null;
  customer_name: string | null;
  sale_date: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  total_cost: string;
  profit: string;
  profit_margin: string | null;
  payment_method: string;
  amount_paid: string;
  change_amount: string;
  status: string;
  cashier_id: string;
  cashier_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  product_id: string | null;
  item_type: string;
  custom_description: string | null;
  product_name: string;
  sku: string | null;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  discount_amount: string;
  total_price: string;
  profit: string;
  batch_id: string | null;
  batch_number: string | null;
  created_at: string;
}

export interface CreateSaleParams {
  customerId?: string;
  customerName?: string;
  saleDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  profit: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  cashierId: string;
  notes?: string;
}

export interface CreateSaleItemParams {
  saleId: string;
  productId: string | null;
  itemType: string;
  customDescription?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  lineProfit: number;
  batchId?: string;
}

/**
 * Get all sales with filters
 */
export async function getAllSales(
  pool: Pool,
  filters?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    cashierId?: string;
    paymentMethod?: string;
    status?: string;
  }
): Promise<SaleRow[]> {
  let query = `
    SELECT 
      s.*,
      c.name as customer_name,
      u.full_name as cashier_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.cashier_id = u.id
    WHERE 1=1
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (filters?.startDate) {
    // Cast to date for proper date comparison with timestamp
    query += ` AND s.sale_date >= $${paramIndex++}::date`;
    values.push(filters.startDate);
  }

  if (filters?.endDate) {
    // Add 1 day and use < to include all of end date
    query += ` AND s.sale_date < ($${paramIndex++}::date + interval '1 day')`;
    values.push(filters.endDate);
  }

  if (filters?.customerId) {
    query += ` AND s.customer_id = $${paramIndex++}`;
    values.push(filters.customerId);
  }

  if (filters?.cashierId) {
    query += ` AND s.cashier_id = $${paramIndex++}`;
    values.push(filters.cashierId);
  }

  if (filters?.paymentMethod) {
    query += ` AND s.payment_method = $${paramIndex++}`;
    values.push(filters.paymentMethod);
  }

  if (filters?.status) {
    query += ` AND s.status = $${paramIndex++}`;
    values.push(filters.status);
  }

  query += ' ORDER BY s.sale_date DESC, s.created_at DESC';

  try {
    const result = await pool.query<SaleRow>(query, values);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get all sales', { filters, error });
    throw error;
  }
}

/**
 * Get sale by ID with items
 */
export async function getSaleById(pool: Pool, id: string): Promise<SaleRow | null> {
  const query = `
    SELECT 
      s.*,
      c.name as customer_name,
      u.full_name as cashier_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.cashier_id = u.id
    WHERE s.id = $1
  `;

  try {
    const result = await pool.query<SaleRow>(query, [id]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get sale by ID', { id, error });
    throw error;
  }
}

/**
 * Get sale by sale number
 */
export async function getSaleBySaleNumber(pool: Pool, saleNumber: string): Promise<SaleRow | null> {
  const query = `
    SELECT 
      s.*,
      c.name as customer_name,
      u.full_name as cashier_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN users u ON s.cashier_id = u.id
    WHERE s.sale_number = $1
  `;

  try {
    const result = await pool.query<SaleRow>(query, [saleNumber]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to get sale by sale number', { saleNumber, error });
    throw error;
  }
}

/**
 * Get sale items
 */
export async function getSaleItems(pool: Pool, saleId: string): Promise<SaleItemRow[]> {
  const query = `
    SELECT 
      si.*,
      si.item_type,
      si.custom_description,
      COALESCE(p.name, si.custom_description) as product_name,
      p.sku,
      ib.batch_number
    FROM sale_items si
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN inventory_batches ib ON si.batch_id = ib.id
    WHERE si.sale_id = $1
    ORDER BY si.created_at
  `;

  try {
    const result = await pool.query<SaleItemRow>(query, [saleId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to get sale items', { saleId, error });
    throw error;
  }
}

/**
 * Generate next sale number
 */
export async function generateSaleNumber(pool: Pool): Promise<string> {
  // Use SQL to get year instead of JavaScript Date object (timezone compliant)
  const query = `
    SELECT 
      sale_number,
      EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
    FROM sales 
    WHERE sale_number LIKE 'SALE-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
    ORDER BY sale_number DESC 
    LIMIT 1
  `;

  try {
    const result = await pool.query(query);
    
    // Get current year from query result or fallback to SQL
    let year: number;
    if (result.rows.length === 0) {
      const yearResult = await pool.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
      year = yearResult.rows[0].year;
      return `SALE-${year}-0001`;
    }

    year = result.rows[0].current_year;
    const lastNumber = result.rows[0].sale_number;
    const lastSequence = parseInt(lastNumber.split('-')[2]);
    const nextSequence = (lastSequence + 1).toString().padStart(4, '0');

    return `SALE-${year}-${nextSequence}`;
  } catch (error) {
    console.error('Failed to generate sale number', error);
    throw error;
  }
}

/**
 * Create sale with transaction
 */
export async function createSale(
  pool: Pool,
  saleData: CreateSaleParams,
  items: CreateSaleItemParams[]
): Promise<string> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate sale number
    const saleNumber = await generateSaleNumber(pool);

    // Create sale
    const saleQuery = `
      INSERT INTO sales (
        sale_number, customer_id, sale_date,
        subtotal, tax_amount, discount_amount, total_amount,
        total_cost, profit, payment_method, amount_paid,
        change_amount, status, cashier_id, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const saleResult = await client.query(saleQuery, [
      saleNumber,
      saleData.customerId || null,
      saleData.saleDate,
      saleData.subtotal,
      saleData.taxAmount,
      saleData.discountAmount,
      saleData.totalAmount,
      saleData.totalCost,
      saleData.profit,
      saleData.paymentMethod,
      saleData.amountPaid,
      saleData.changeAmount,
      'COMPLETED',
      saleData.cashierId,
      saleData.notes || null,
    ]);

    const saleId = saleResult.rows[0].id;

    // Create sale items
    for (const item of items) {
      const isCustomItem = item.itemType === 'SERVICE' || item.itemType === 'CUSTOM';

      const itemQuery = `
        INSERT INTO sale_items (
          sale_id, product_id, item_type, custom_description,
          quantity, unit_price, unit_cost,
          discount_amount, total_price, profit, batch_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;

      await client.query(itemQuery, [
        saleId,
        isCustomItem ? null : item.productId,
        item.itemType || 'PRODUCT',
        item.customDescription || null,
        item.quantity,
        item.unitPrice,
        item.unitCost,
        item.discountAmount || 0,
        item.totalAmount, // Maps to total_price
        item.lineProfit || 0, // Maps to profit
        item.batchId || null,
      ]);

      // =================================================================
      // INVENTORY DEDUCTION: Skip for SERVICE/CUSTOM items (no inventory)
      // =================================================================
      if (isCustomItem) {
        continue; // No inventory to deduct for service/custom items
      }
      let remainingToDeduct = item.quantity;
      let primaryBatchId = item.batchId || null;
      
      // Get all available batches sorted by FEFO (First Expiry First Out)
      // Lock rows to prevent concurrent modification (FOR UPDATE)
      const batchesQuery = `
        SELECT id, remaining_quantity, expiry_date
        FROM inventory_batches
        WHERE product_id = $1 AND status = 'ACTIVE' AND remaining_quantity > 0
        ORDER BY 
          CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
          expiry_date ASC,
          received_date ASC
        FOR UPDATE
      `;
      const batchesResult = await client.query(batchesQuery, [item.productId]);
      
      if (batchesResult.rows.length > 0) {
        // Product has batches - deduct using FEFO across multiple batches if needed
        for (const batch of batchesResult.rows) {
          if (remainingToDeduct <= 0) break;
          
          const batchRemaining = parseFloat(batch.remaining_quantity);
          // SAFETY: Only deduct what's actually available in this batch
          const deductFromThisBatch = Math.min(remainingToDeduct, batchRemaining);
          
          if (deductFromThisBatch > 0) {
            // SAFETY CHECK: Verify we won't go negative
            if (deductFromThisBatch > batchRemaining) {
              logger.warn('Batch deduction safety check triggered', {
                batchId: batch.id,
                requested: deductFromThisBatch,
                available: batchRemaining,
              });
              continue; // Skip this batch, try next one
            }
            
            // Deduct from this batch with explicit non-negative constraint
            const updateBatchQuery = `
              UPDATE inventory_batches
              SET remaining_quantity = GREATEST(0, remaining_quantity - $1),
                  status = CASE 
                    WHEN remaining_quantity - $1 <= 0 THEN 'DEPLETED'::batch_status 
                    ELSE status 
                  END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND remaining_quantity >= $1
              RETURNING remaining_quantity
            `;
            const updateResult = await client.query(updateBatchQuery, [deductFromThisBatch, batch.id]);
            
            // Verify the update succeeded (row was actually updated)
            if (updateResult.rowCount === 0) {
              // Batch was modified by another transaction, skip to next batch
              logger.warn('Batch concurrent modification detected, skipping', { batchId: batch.id });
              continue;
            }
            
            // Track first batch used for the sale_item record
            if (!primaryBatchId) {
              primaryBatchId = batch.id;
            }
            
            remainingToDeduct -= deductFromThisBatch;
          }
        }
        
        // SAFETY: If we couldn't deduct everything from batches, rollback
        if (remainingToDeduct > 0.001) { // Allow tiny floating point tolerance
          throw new Error(
            `Unable to allocate inventory for product. ` +
            `Remaining: ${remainingToDeduct.toFixed(4)} units could not be deducted.`
          );
        }
        
        // Update sale_item with the primary batch_id used
        if (primaryBatchId) {
          await client.query(
            'UPDATE sale_items SET batch_id = $1 WHERE sale_id = $2 AND product_id = $3',
            [primaryBatchId, saleId, item.productId]
          );
        }
        // NOTE: Trigger trg_sync_inventory_quantity automatically updates products.quantity_on_hand
      } else {
        // No batches exist for this product - update product directly with safety check
        const updateProductQuery = `
          UPDATE products
          SET quantity_on_hand = GREATEST(0, quantity_on_hand - $1),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND quantity_on_hand >= $1
          RETURNING quantity_on_hand
        `;
        const updateResult = await client.query(updateProductQuery, [item.quantity, item.productId]);
        
        if (updateResult.rowCount === 0) {
          throw new Error(
            `Insufficient stock for product. The stock may have been modified by another transaction.`
          );
        }
      }
    }

    // ===================================================================
    // CRITICAL: Create invoice for ANY sale with customer + remaining balance
    // Invoice tracks unpaid amount regardless of how partial payment was made
    // Examples:
    // - Pure credit (no payment): Creates invoice for full amount
    // - Partial payment (400k CASH on 1M): Creates invoice for 600k balance
    // - Full payment: No invoice needed (balance = 0)
    // ===================================================================
    const unpaidBalance = saleData.totalAmount - (saleData.amountPaid || 0);
    if (saleData.customerId && unpaidBalance > 0.01) {
      // Generate invoice number (INV-YYYY-####)
      const invoiceNumberQuery = `
        SELECT 
          invoice_number,
          EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
        FROM invoices 
        WHERE invoice_number LIKE 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
        ORDER BY invoice_number DESC 
        LIMIT 1
      `;
      
      const invoiceNumResult = await client.query(invoiceNumberQuery);
      
      let invoiceNumber: string;
      if (invoiceNumResult.rows.length === 0) {
        const yearResult = await client.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
        const year = yearResult.rows[0].year;
        invoiceNumber = `INV-${year}-0001`;
      } else {
        const year = invoiceNumResult.rows[0].current_year;
        const lastNumber = invoiceNumResult.rows[0].invoice_number;
        const lastSequence = parseInt(lastNumber.split('-')[2]);
        const nextSequence = (lastSequence + 1).toString().padStart(4, '0');
        invoiceNumber = `INV-${year}-${nextSequence}`;
      }
      
      // Create invoice (linked to sale)
      const createInvoiceQuery = `
        INSERT INTO invoices (
          invoice_number, customer_id, sale_id, issue_date, due_date,
          subtotal, tax_amount, discount_amount, total_amount,
          amount_paid, amount_due, status, notes, created_by_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `;
      
      const issueDate = saleData.saleDate || new Date().toISOString();
      const dueDate = new Date(new Date(issueDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from sale
      const unpaidAmount = saleData.totalAmount - (saleData.amountPaid || 0);
      // CRITICAL FIX: Use correct enum values (DRAFT for new unpaid invoices, not UNPAID)
      // Valid enum: DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED
      const invoiceStatus = unpaidAmount > 0 ? (saleData.amountPaid > 0 ? 'PARTIALLY_PAID' : 'DRAFT') : 'PAID';
      
      const invoiceResult = await client.query(createInvoiceQuery, [
        invoiceNumber,
        saleData.customerId,
        saleId,
        issueDate,
        dueDate,
        saleData.subtotal,
        saleData.taxAmount,
        saleData.discountAmount,
        saleData.totalAmount,
        saleData.amountPaid || 0,
        unpaidAmount,
        invoiceStatus,
        saleData.notes || `Credit sale ${saleNumber}`,
        saleData.cashierId, // created_by = cashier
      ]);
      
      const invoiceId = invoiceResult.rows[0].id;
      
      logger.info('Invoice created for credit sale', {
        invoiceId,
        invoiceNumber,
        saleId,
        customerId: saleData.customerId,
        totalAmount: saleData.totalAmount,
        amountPaid: saleData.amountPaid || 0,
        amountDue: unpaidAmount,
        status: invoiceStatus,
      });
      
      // If partial payment was made, record it
      if (saleData.amountPaid > 0) {
        // Generate receipt number (RCP-YYYY-####)
        const receiptNumberQuery = `
          SELECT 
            receipt_number,
            EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year
          FROM invoice_payments 
          WHERE receipt_number LIKE 'RCP-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-%'
          ORDER BY receipt_number DESC 
          LIMIT 1
        `;
        
        const receiptNumResult = await client.query(receiptNumberQuery);
        
        let receiptNumber: string;
        if (receiptNumResult.rows.length === 0) {
          const yearResult = await client.query('SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as year');
          const year = yearResult.rows[0].year;
          receiptNumber = `RCP-${year}-0001`;
        } else {
          const year = receiptNumResult.rows[0].current_year;
          const lastNumber = receiptNumResult.rows[0].receipt_number;
          const lastSequence = parseInt(lastNumber.split('-')[2]);
          const nextSequence = (lastSequence + 1).toString().padStart(4, '0');
          receiptNumber = `RCP-${year}-${nextSequence}`;
        }
        
        // Record partial payment
        const createPaymentQuery = `
          INSERT INTO invoice_payments (
            receipt_number, invoice_id, payment_date, payment_method,
            amount, reference_number, notes, processed_by_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;
        
        await client.query(createPaymentQuery, [
          receiptNumber,
          invoiceId,
          issueDate,
          saleData.paymentMethod, // Use actual payment method from sale (CASH, CARD, MOBILE_MONEY)
          saleData.amountPaid,
          `Sale ${saleNumber}`,
          'Partial payment at time of sale',
          saleData.cashierId,
        ]);
        
        logger.info('Partial payment recorded', {
          receiptNumber,
          invoiceId,
          amount: saleData.amountPaid,
        });
      }
    }
    
    // NOTE: Customer balance will be auto-updated by database trigger (trg_sync_customer_balance_on_invoice)
    // Trigger recalculates balance from invoices table (single source of truth)
    // DO NOT manually update customer.balance here - it causes double counting!

    await client.query('COMMIT');
    logger.info('Sale created', { saleId, saleNumber, totalAmount: saleData.totalAmount });

    return saleId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to create sale', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get sales summary (for dashboard)
 * SINGLE SOURCE OF TRUTH: Credit outstanding comes from invoices table, not sales
 */
export async function getSalesSummary(
  pool: Pool,
  startDate?: string,
  endDate?: string
): Promise<any> {
  // ==========================================================================
  // SINGLE SOURCE OF TRUTH ENFORCEMENT:
  // - Sales totals come from sales table
  // - Credit outstanding comes from invoices table (the authoritative source)
  // - This matches the database trigger fn_update_customer_balance_internal
  // ==========================================================================
  
  let salesQuery = `
    SELECT 
      COUNT(*) as total_sales,
      COALESCE(SUM(total_amount), 0) as total_sales_value,
      COALESCE(SUM(amount_paid), 0) as total_revenue,
      COALESCE(SUM(total_cost), 0) as total_cost,
      COALESCE(SUM(profit), 0) as total_profit,
      COALESCE(AVG(profit_margin), 0) * 100 as avg_profit_margin  -- Convert decimal to percentage
    FROM sales
    WHERE status = 'COMPLETED'
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    salesQuery += ` AND sale_date >= $${paramIndex++}`;
    values.push(startDate);
  }

  if (endDate) {
    salesQuery += ` AND sale_date <= $${paramIndex++}`;
    values.push(endDate);
  }

  try {
    const salesResult = await pool.query(salesQuery, values);
    const salesData = salesResult.rows[0];
    
    // Get credit outstanding from INVOICES table (single source of truth)
    // This matches fn_update_customer_balance_internal in triggers
    let creditQuery = `
      SELECT COALESCE(SUM(amount_due), 0) as total_credit_outstanding
      FROM invoices
      WHERE status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
    `;
    
    // Apply date filter to invoices by linked sale_date if provided
    const creditValues: any[] = [];
    let creditParamIndex = 1;
    
    if (startDate || endDate) {
      creditQuery = `
        SELECT COALESCE(SUM(i.amount_due), 0) as total_credit_outstanding
        FROM invoices i
        LEFT JOIN sales s ON i.sale_id = s.id
        WHERE i.status IN ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE')
      `;
      
      if (startDate) {
        creditQuery += ` AND (s.sale_date >= $${creditParamIndex++} OR i.issue_date >= $${creditParamIndex++})`;
        creditValues.push(startDate, startDate);
      }
      
      if (endDate) {
        creditQuery += ` AND (s.sale_date <= $${creditParamIndex++} OR i.issue_date <= $${creditParamIndex++})`;
        creditValues.push(endDate, endDate);
      }
    }
    
    const creditResult = await pool.query(creditQuery, creditValues);
    const creditData = creditResult.rows[0];
    
    return {
      ...salesData,
      total_credit_outstanding: creditData.total_credit_outstanding,
    };
  } catch (error) {
    console.error('Failed to get sales summary', error);
    throw error;
  }
}

/**
 * Get top selling products
 */
export async function getTopSellingProducts(
  pool: Pool,
  limit: number = 10,
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  let query = `
    SELECT 
      p.id,
      p.name,
      p.sku,
      SUM(si.quantity) as total_quantity,
      SUM(si.total_price) as total_revenue,
      COUNT(DISTINCT si.sale_id) as times_sold
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.status = 'COMPLETED'
  `;

  const values: any[] = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND s.sale_date >= $${paramIndex++}`;
    values.push(startDate);
  }

  if (endDate) {
    query += ` AND s.sale_date <= $${paramIndex++}`;
    values.push(endDate);
  }

  query += `
    GROUP BY p.id, p.name, p.sku
    ORDER BY total_quantity DESC
    LIMIT $${paramIndex}
  `;
  values.push(limit);

  try {
    const result = await pool.query(query, values);
    return result.rows;
  } catch (error) {
    console.error('Failed to get top selling products', error);
    throw error;
  }
}

/**
 * Void a sale
 */
export async function voidSale(
  pool: Pool,
  saleId: string,
  voidReason: string,
  notes: string,
  voidedBy: string
): Promise<void> {
  const query = `
    UPDATE sales
    SET status = 'VOID',
        notes = COALESCE(notes || E'\n\n', '') || 'VOID: ' || $2 || CASE WHEN $3 != '' THEN E'\nNotes: ' || $3 ELSE '' END
    WHERE id = $1 AND status != 'VOID'
  `;

  try {
    await pool.query(query, [saleId, voidReason, notes || '']);
  } catch (error) {
    logger.error('Failed to void sale', { error, saleId });
    throw error;
  }
}

/**
 * Create refund record
 */
export async function createRefund(
  pool: Pool,
  data: {
    saleId: string;
    refundType: string;
    refundReason: string;
    refundAmount: number;
    returnToInventory: boolean;
    notes?: string;
    processedBy: string;
  }
): Promise<string> {
  const query = `
    INSERT INTO refunds (
      sale_id, refund_type, refund_reason, refund_amount,
      return_to_inventory, notes, processed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;

  try {
    const result = await pool.query(query, [
      data.saleId,
      data.refundType,
      data.refundReason,
      data.refundAmount,
      data.returnToInventory,
      data.notes || null,
      data.processedBy,
    ]);
    return result.rows[0].id;
  } catch (error) {
    logger.error('Failed to create refund', { error, data });
    throw error;
  }
}

/**
 * Create refund item
 */
export async function createRefundItem(
  pool: Pool,
  refundId: string,
  item: { saleItemId: string; quantityToRefund: number; refundAmount: number }
): Promise<void> {
  const query = `
    INSERT INTO refund_items (refund_id, sale_item_id, quantity_refunded, refund_amount)
    VALUES ($1, $2, $3, $4)
  `;

  try {
    await pool.query(query, [refundId, item.saleItemId, item.quantityToRefund, item.refundAmount]);
  } catch (error) {
    logger.error('Failed to create refund item', { error, refundId, item });
    throw error;
  }
}

/**
 * Restore inventory for refunded items
 * Updates batch remaining_quantity - trigger will recalculate product quantity_on_hand
 */
export async function restoreInventory(
  pool: Pool,
  productId: string,
  batchId: string,
  quantity: number
): Promise<void> {
  const query = `
    UPDATE inventory_batches
    SET remaining_quantity = LEAST(quantity, remaining_quantity + $3),
        status = CASE WHEN remaining_quantity + $3 > 0 THEN 'ACTIVE'::batch_status ELSE status END
    WHERE product_id = $1 AND id = $2
  `;

  try {
    await pool.query(query, [productId, batchId, quantity]);
    // NOTE: Trigger trg_sync_inventory_quantity automatically updates products.quantity_on_hand
  } catch (error) {
    logger.error('Failed to restore inventory', { error, productId, batchId, quantity });
    throw error;
  }
}

/**
 * Update invoice for refund
 * SINGLE SOURCE OF TRUTH: Customer balance is calculated from invoices by trigger
 * DO NOT directly manipulate customer.balance - update the invoice instead
 */
export async function updateInvoiceForRefund(
  pool: Pool,
  invoiceId: string,
  refundAmount: number
): Promise<void> {
  // Reduce amount_due on the invoice - trigger will recalculate customer balance
  const query = `
    UPDATE invoices
    SET amount_paid = amount_paid + $2,
        amount_due = GREATEST(0, amount_due - $2),
        status = CASE 
          WHEN amount_due - $2 <= 0 THEN 'PAID'::invoice_status
          ELSE 'PARTIALLY_PAID'::invoice_status
        END,
        updated_at = NOW()
    WHERE id = $1
  `;

  try {
    await pool.query(query, [invoiceId, refundAmount]);
    // Customer balance will be auto-recalculated by trg_sync_customer_balance_on_invoice
  } catch (error) {
    logger.error('Failed to update invoice for refund', { error, invoiceId, refundAmount });
    throw error;
  }
}

/**
 * @deprecated Use updateInvoiceForRefund instead - customer balance should be trigger-managed
 * This function exists for backward compatibility but should NOT be used
 */
export async function updateCustomerBalanceForRefund(
  pool: Pool,
  customerId: string,
  refundAmount: number
): Promise<void> {
  logger.warn('DEPRECATED: updateCustomerBalanceForRefund bypasses single source of truth. Use updateInvoiceForRefund instead.');
  // DO NOT directly update customer.balance - it will be overwritten by trigger
  // For now, do nothing - caller should use updateInvoiceForRefund instead
  return;
}


