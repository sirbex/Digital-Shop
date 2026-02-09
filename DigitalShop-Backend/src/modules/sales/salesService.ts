import { Pool } from 'pg';
import Decimal from 'decimal.js';
import * as salesRepository from './salesRepository.js';

export interface Sale {
  id: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string | null;
  saleDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCost: number;
  profit: number;
  profitMargin: number | null;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT';
  amountPaid: number;
  changeAmount: number;
  status: 'COMPLETED' | 'VOID' | 'REFUNDED';
  cashierId: string;
  cashierName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string | null;
  itemType: string;
  customDescription: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  lineProfit: number;
  batchId: string | null;
  batchNumber: string | null;
  createdAt: string;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface CreateSaleData {
  customerId?: string;
  customerName?: string;
  saleDate?: string;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'CREDIT';
  amountPaid: number;
  cashierId: string;
  notes?: string;
  // Frontend-calculated totals (used for payment validation to ensure consistency)
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  items: {
    productId?: string | null;
    itemType?: string;
    customDescription?: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    taxRate?: number;
    discountAmount?: number;
    batchId?: string;
  }[];
}

export interface SalesFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  cashierId?: string;
  paymentMethod?: string;
  status?: string;
}

/**
 * Convert database row to Sale object
 */
function toSale(row: salesRepository.SaleRow): Sale {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    saleDate: row.sale_date,
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.tax_amount),
    discountAmount: parseFloat(row.discount_amount),
    totalAmount: parseFloat(row.total_amount),
    totalCost: parseFloat(row.total_cost),
    profit: parseFloat(row.profit),
    // Convert profit_margin from decimal (0.25) to percentage (25) for consistent frontend display
    profitMargin: row.profit_margin ? parseFloat(row.profit_margin) * 100 : null,
    paymentMethod: row.payment_method as any,
    amountPaid: parseFloat(row.amount_paid),
    changeAmount: parseFloat(row.change_amount),
    status: row.status as any,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * Convert database row to SaleItem object
 */
function toSaleItem(row: salesRepository.SaleItemRow): SaleItem {
  const quantity = parseFloat(row.quantity);
  const unitPrice = parseFloat(row.unit_price);
  const discountAmount = parseFloat(row.discount_amount || '0');
  const totalPrice = parseFloat(row.total_price);
  // Calculate subtotal from total + discount (since we don't store subtotal separately)
  const subtotal = totalPrice + discountAmount;
  
  return {
    id: row.id,
    saleId: row.sale_id,
    productId: row.product_id,
    itemType: row.item_type || 'PRODUCT',
    customDescription: row.custom_description,
    productName: row.product_name,
    sku: row.sku,
    quantity,
    unitPrice,
    unitCost: parseFloat(row.unit_cost || '0'),
    subtotal,
    taxAmount: 0, // Tax not stored at item level in current schema
    discountAmount,
    totalAmount: totalPrice,
    lineProfit: parseFloat(row.profit || '0'),
    batchId: row.batch_id,
    batchNumber: row.batch_number,
    createdAt: row.created_at,
  };
}

/**
 * Calculate sale totals using Decimal.js
 */
function calculateSaleTotals(items: CreateSaleData['items'], cartDiscountAmount?: number) {
  let subtotal = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalItemDiscount = new Decimal(0);
  let totalCost = new Decimal(0);

  const processedItems = items.map(item => {
    const quantity = new Decimal(item.quantity);
    const unitPrice = new Decimal(item.unitPrice);
    const unitCost = new Decimal(item.unitCost || 0);
    const taxRate = new Decimal(item.taxRate || 0);
    const discountAmount = new Decimal(item.discountAmount || 0);

    // Calculate item subtotal (before discount)
    const itemSubtotal = quantity.times(unitPrice);

    // Calculate amount after discount (tax is calculated on discounted amount)
    const afterDiscount = itemSubtotal.minus(discountAmount);

    // Calculate tax amount ON THE DISCOUNTED AMOUNT (matches frontend calculation)
    const taxAmount = afterDiscount.times(taxRate).dividedBy(100);

    // Calculate item total: (subtotal - discount) + tax
    const itemTotal = afterDiscount.plus(taxAmount);

    // Calculate cost and profit
    // CRITICAL: Profit EXCLUDES tax (tax is government money, not profit)
    // lineProfit = (revenue before tax) - cost = afterDiscount - itemCost
    const itemCost = quantity.times(unitCost);
    const lineProfit = afterDiscount.minus(itemCost);

    // Accumulate totals
    subtotal = subtotal.plus(itemSubtotal);
    totalTax = totalTax.plus(taxAmount);
    totalItemDiscount = totalItemDiscount.plus(discountAmount);
    totalCost = totalCost.plus(itemCost);

    return {
      productId: item.productId || null,
      itemType: item.itemType || 'PRODUCT',
      customDescription: item.customDescription,
      quantity: quantity.toNumber(),
      unitPrice: unitPrice.toNumber(),
      unitCost: unitCost.toNumber(),
      subtotal: itemSubtotal.toNumber(),
      taxAmount: taxAmount.toNumber(),
      discountAmount: discountAmount.toNumber(),
      totalAmount: itemTotal.toNumber(),
      lineProfit: lineProfit.toNumber(),
      batchId: item.batchId,
    };
  });

  // Cart-level discount (applied to the whole order, not distributed to items)
  const cartDiscount = new Decimal(cartDiscountAmount || 0);
  const totalDiscount = totalItemDiscount.plus(cartDiscount);

  // Total amount = subtotal - all discounts + tax
  const totalAmount = subtotal.minus(totalDiscount).plus(totalTax);

  // CRITICAL: Profit = Revenue - Cost
  // Revenue = subtotal - ALL discounts (item-level + cart-level), EXCLUDING tax
  // Tax is government money, NOT profit
  const revenue = subtotal.minus(totalDiscount);
  const profit = revenue.minus(totalCost);
  const profitMargin = revenue.greaterThan(0) 
    ? profit.dividedBy(revenue).times(100) 
    : new Decimal(0);

  return {
    items: processedItems,
    subtotal: subtotal.toNumber(),
    taxAmount: totalTax.toNumber(),
    discountAmount: totalDiscount.toNumber(),
    totalAmount: totalAmount.toNumber(),
    totalCost: totalCost.toNumber(),
    profit: profit.toNumber(),
    profitMargin: profitMargin.toNumber(),
  };
}

/**
 * Get all sales
 */
export async function getAllSales(pool: Pool, filters?: SalesFilters): Promise<Sale[]> {
  const rows = await salesRepository.getAllSales(pool, filters);
  return rows.map(toSale);
}

/**
 * Get sale by ID with items
 */
export async function getSaleById(pool: Pool, id: string): Promise<SaleWithItems> {
  const saleRow = await salesRepository.getSaleById(pool, id);

  if (!saleRow) {
    throw new Error('Sale not found');
  }

  const itemRows = await salesRepository.getSaleItems(pool, id);

  return {
    ...toSale(saleRow),
    items: itemRows.map(toSaleItem),
  };
}

/**
 * Get sale by sale number
 */
export async function getSaleBySaleNumber(pool: Pool, saleNumber: string): Promise<SaleWithItems> {
  const saleRow = await salesRepository.getSaleBySaleNumber(pool, saleNumber);

  if (!saleRow) {
    throw new Error('Sale not found');
  }

  const itemRows = await salesRepository.getSaleItems(pool, saleRow.id);

  return {
    ...toSale(saleRow),
    items: itemRows.map(toSaleItem),
  };
}

/**
 * Create sale
 */
export async function createSale(pool: Pool, data: CreateSaleData): Promise<string> {
  // Validate items
  if (!data.items || data.items.length === 0) {
    throw new Error('Sale must have at least one item');
  }

  // Validate payment method
  const validPaymentMethods = ['CASH', 'CARD', 'MOBILE_MONEY', 'CREDIT'];
  if (!validPaymentMethods.includes(data.paymentMethod)) {
    throw new Error('Invalid payment method');
  }

  // ========================================================================
  // STOCK AVAILABILITY VALIDATION (BULLETPROOF)
  // Check that all products have sufficient stock BEFORE attempting the sale
  // Handles: zero/negative quantities, same product multiple times, no batches
  // SERVICE/CUSTOM items bypass stock checks entirely
  // ========================================================================
  
  // Validate individual item quantities and separate product vs custom items
  const productItems: typeof data.items = [];
  const customItems: typeof data.items = [];

  for (const item of data.items) {
    if (!item.quantity || item.quantity <= 0) {
      throw new Error('Item quantity must be greater than zero');
    }
    const isCustom = item.itemType === 'SERVICE' || item.itemType === 'CUSTOM';
    if (!isCustom && !item.productId) {
      throw new Error('Product ID is required for product items');
    }
    if (isCustom && (!item.customDescription || !item.customDescription.trim())) {
      throw new Error('Description is required for service/custom items');
    }
    if (isCustom) {
      customItems.push(item);
    } else {
      productItems.push(item);
    }
  }
  
  // Aggregate quantities by product (only for inventory-tracked items)
  const quantityByProduct = new Map<string, number>();
  for (const item of productItems) {
    const current = quantityByProduct.get(item.productId!) || 0;
    quantityByProduct.set(item.productId!, current + item.quantity);
  }
  
  const productIds = Array.from(quantityByProduct.keys());
  
  // Stock check only needed for product items
  if (productIds.length > 0) {
  // Get product details with current stock (both batch and direct quantity)
  const stockCheckResult = await pool.query(
    `SELECT 
      p.id, 
      p.name, 
      p.sku,
      p.quantity_on_hand,
      COALESCE(
        (SELECT SUM(remaining_quantity) 
         FROM inventory_batches 
         WHERE product_id = p.id AND status = 'ACTIVE' AND remaining_quantity > 0
        ), 0
      ) as available_batch_qty
    FROM products p 
    WHERE p.id = ANY($1)`,
    [productIds]
  );
  
  // Verify all products exist
  if (stockCheckResult.rows.length !== productIds.length) {
    const foundIds = new Set(stockCheckResult.rows.map(r => r.id));
    const missingId = productIds.find(id => !foundIds.has(id));
    throw new Error(`Product not found: ${missingId}`);
  }
  
  const stockMap = new Map<string, { name: string; sku: string; quantityOnHand: number; availableBatchQty: number }>();
  for (const row of stockCheckResult.rows) {
    stockMap.set(row.id, {
      name: row.name,
      sku: row.sku,
      quantityOnHand: parseFloat(row.quantity_on_hand) || 0,
      availableBatchQty: parseFloat(row.available_batch_qty) || 0,
    });
  }
  
  // Validate stock for each product (aggregated quantities)
  for (const [productId, totalQuantity] of quantityByProduct.entries()) {
    const stock = stockMap.get(productId);
    if (!stock) {
      throw new Error(`Product not found: ${productId}`);
    }
    
    // Determine available quantity:
    // - If product has active batches, use batch total (more accurate)
    // - Otherwise fall back to quantity_on_hand (for non-batch-tracked products)
    const availableQty = stock.availableBatchQty > 0 ? stock.availableBatchQty : stock.quantityOnHand;
    
    if (totalQuantity > availableQty) {
      throw new Error(
        `Insufficient stock for "${stock.name}" (${stock.sku}). ` +
        `Requested: ${totalQuantity}, Available: ${availableQty}`
      );
    }
  }
  } // end if productIds.length > 0

  // Fetch product details for inventory items (cost price, tax rate)
  const productMap = new Map<string, { costPrice: number; taxRate: number }>();
  if (productIds.length > 0) {
  const productDetailsResult = await pool.query(
    `SELECT id, cost_price, tax_rate, is_taxable FROM products WHERE id = ANY($1)`,
    [productIds]
  );
  
  for (const row of productDetailsResult.rows) {
    productMap.set(row.id, {
      costPrice: parseFloat(row.cost_price) || 0,
      taxRate: row.is_taxable ? (parseFloat(row.tax_rate) || 0) : 0,
    });
  }
  }

  // Enrich items with product details
  // CRITICAL: taxRate must be converted from decimal (0.18) to percentage (18) for calculateSaleTotals
  // SERVICE/CUSTOM items use the values as-sent (no product lookup)
  const enrichedItems = data.items.map(item => {
    const isCustom = item.itemType === 'SERVICE' || item.itemType === 'CUSTOM';
    const product = isCustom ? null : productMap.get(item.productId!);
    // Frontend sends taxRate as decimal (0.18 = 18%), backend calculateSaleTotals expects percentage (18)
    const frontendTaxRate = item.taxRate ?? 0;
    const productTaxRate = product?.taxRate ?? 0;
    // Convert to percentage: if frontend sent it, convert; otherwise use product's rate converted
    const taxRateAsPercentage = frontendTaxRate > 0 
      ? frontendTaxRate * 100  // Convert 0.18 -> 18
      : productTaxRate * 100;  // Convert 0.18 -> 18
    
    return {
      productId: isCustom ? null : item.productId,
      itemType: item.itemType || 'PRODUCT',
      customDescription: item.customDescription,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: isCustom ? 0 : (item.unitCost ?? product?.costPrice ?? 0),
      taxRate: taxRateAsPercentage,
      discountAmount: item.discountAmount ?? 0,
      batchId: item.batchId,
    };
  });

  // Calculate totals
  // Cart-level discount = total discount from frontend - sum of item-level discounts
  // This ensures cart-wide discounts (not distributed to items) are included in profit calc
  const itemLevelDiscountTotal = enrichedItems.reduce((sum, item) => sum + (item.discountAmount || 0), 0);
  const frontendTotalDiscount = data.discountAmount || 0;
  const cartDiscount = Math.max(0, frontendTotalDiscount - itemLevelDiscountTotal);
  
  const totals = calculateSaleTotals(enrichedItems, cartDiscount);

  // ========================================================================
  // CRITICAL FIX: Use frontend's totalAmount for payment validation
  // This ensures the same total is used for validation on both frontend and backend.
  // The recalculated totals will still be saved to the database for accuracy.
  // ========================================================================
  const totalForValidation = data.totalAmount !== undefined ? data.totalAmount : totals.totalAmount;

  // Calculate change using the FRONTEND's total (for consistency with UI)
  const changeAmount = new Decimal(data.amountPaid).minus(totalForValidation);

  // ========================================================================
  // CRITICAL FIX: Allow partial payments when customer is selected
  // - Walk-in (no customer): Must pay in full
  // - With customer: Partial payment allowed, creates invoice for remaining
  // ========================================================================
  if (changeAmount.lessThan(-0.01)) { // Allow tiny floating point tolerance
    // Underpayment - only allowed with a customer (will create invoice for balance)
    if (!data.customerId) {
      throw new Error('Walk-in customers must pay in full. Select a customer for partial payment.');
    }
    // With customer, partial payment is allowed - invoice will be created by repository
  }

  // Prepare sale data
  // ========================================================================
  // CRITICAL FIX: changeAmount must be >= 0 (database constraint chk_sale_change)
  // - Overpayment: changeAmount = positive (change due to customer)
  // - Exact payment: changeAmount = 0
  // - Partial payment: changeAmount = 0 (balance goes to invoice, not negative change)
  // ========================================================================
  const finalChangeAmount = changeAmount.greaterThan(0) ? changeAmount.toNumber() : 0;

  const saleData: salesRepository.CreateSaleParams = {
    customerId: data.customerId,
    customerName: data.customerName,
    saleDate: data.saleDate || new Date().toISOString(),
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    discountAmount: totals.discountAmount,
    totalAmount: totals.totalAmount,
    totalCost: totals.totalCost,
    profit: totals.profit,
    paymentMethod: data.paymentMethod,
    amountPaid: data.amountPaid,
    changeAmount: finalChangeAmount,
    cashierId: data.cashierId,
    notes: data.notes,
  };

  // Create sale with items (repository adds saleId to each item)
  const saleId = await salesRepository.createSale(pool, saleData, totals.items as any);

  return saleId;
}

/**
 * Get sales summary
 */
export async function getSalesSummary(
  pool: Pool,
  startDate?: string,
  endDate?: string
): Promise<any> {
  const summary = await salesRepository.getSalesSummary(pool, startDate, endDate);

  if (!summary) {
    return {
      totalSales: 0,
      totalSalesValue: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
      avgProfitMargin: 0,
      totalCreditOutstanding: 0,
    };
  }

  return {
    totalSales: parseInt(summary.total_sales) || 0,
    totalSalesValue: parseFloat(summary.total_sales_value) || 0,
    totalRevenue: parseFloat(summary.total_revenue) || 0,
    totalCost: parseFloat(summary.total_cost) || 0,
    totalProfit: parseFloat(summary.total_profit) || 0,
    avgProfitMargin: parseFloat(summary.avg_profit_margin) || 0,
    totalCreditOutstanding: parseFloat(summary.total_credit_outstanding) || 0,
  };
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
  const products = await salesRepository.getTopSellingProducts(pool, limit, startDate, endDate);

  return products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    totalQuantity: parseFloat(p.total_quantity),
    totalRevenue: parseFloat(p.total_revenue),
    timesSold: parseInt(p.times_sold),
  }));
}

/**
 * Void a sale (Manager/Admin only)
 * Marks sale as VOIDED and restores inventory
 */
export async function voidSale(
  pool: Pool,
  saleId: string,
  voidReason: string,
  notes: string,
  voidedBy: string
): Promise<void> {
  // Check if sale exists and is not already voided
  const sale = await salesRepository.getSaleById(pool, saleId);
  if (!sale) {
    throw new Error('Sale not found');
  }
  
  if (sale.status === 'VOID') {
    throw new Error('Sale is already voided');
  }

  // Void the sale (trigger will handle inventory restoration)
  await salesRepository.voidSale(pool, saleId, voidReason, notes, voidedBy);
}

/**
 * Process refund for a sale
 * Supports full or partial refunds with inventory restoration
 */
export async function refundSale(
  pool: Pool,
  data: {
    saleId: string;
    refundType: string;
    refundReason: string;
    items: Array<{ saleItemId: string; quantityToRefund: number; refundAmount: number }>;
    returnToInventory: boolean;
    refundAmount: number;
    notes?: string;
    processedBy: string;
  }
): Promise<string> {
  // Validate sale exists
  const sale = await salesRepository.getSaleById(pool, data.saleId);
  if (!sale) {
    throw new Error('Sale not found');
  }

  if (sale.status === 'VOID') {
    throw new Error('Cannot refund a voided sale');
  }

  // Get sale items to validate refund quantities
  const saleItems = await salesRepository.getSaleItems(pool, data.saleId);
  
  for (const refundItem of data.items) {
    const saleItem = saleItems.find(si => si.id === refundItem.saleItemId);
    if (!saleItem) {
      throw new Error(`Sale item ${refundItem.saleItemId} not found`);
    }

    // Check if refund quantity is valid
    if (refundItem.quantityToRefund > parseFloat(saleItem.quantity)) {
      throw new Error(`Refund quantity for ${saleItem.product_name} exceeds sold quantity`);
    }
  }

  // Create refund record
  const refundId = await salesRepository.createRefund(pool, {
    saleId: data.saleId,
    refundType: data.refundType,
    refundReason: data.refundReason,
    refundAmount: data.refundAmount,
    returnToInventory: data.returnToInventory,
    notes: data.notes,
    processedBy: data.processedBy,
  });

  // Create refund items
  for (const item of data.items) {
    await salesRepository.createRefundItem(pool, refundId, item);
  }

  // If returning to inventory, restore stock
  if (data.returnToInventory) {
    for (const refundItem of data.items) {
      const saleItem = saleItems.find(si => si.id === refundItem.saleItemId);
      if (saleItem && saleItem.batch_id && saleItem.product_id) {
        // Restore inventory to original batch (only for product items)
        await salesRepository.restoreInventory(
          pool,
          saleItem.product_id,
          saleItem.batch_id,
          refundItem.quantityToRefund
        );
      }
    }
  }

  // ========================================================================
  // SINGLE SOURCE OF TRUTH: Update invoice instead of customer balance
  // The invoice trigger will automatically recalculate customer balance
  // ========================================================================
  if (sale.customer_id) {
    // Find the invoice linked to this sale
    const invoiceResult = await pool.query(
      'SELECT id FROM invoices WHERE sale_id = $1 AND status != \'PAID\' AND status != \'CANCELLED\' LIMIT 1',
      [data.saleId]
    );
    
    if (invoiceResult.rows.length > 0) {
      const invoiceId = invoiceResult.rows[0].id;
      // Update invoice - trigger will recalculate customer balance
      await salesRepository.updateInvoiceForRefund(pool, invoiceId, data.refundAmount);
    }
    // If no invoice found (fully paid or cash sale), no balance update needed
  }

  return refundId;
}
