import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as inventoryController from './inventoryController.js';
import * as inventoryService from './inventoryService.js';
import { pool } from '../../db/pool.js';

const router = Router();

// Validation schemas - matching SamplePOS
const AdjustInventorySchema = z
  .object({
    productId: z.string().uuid('Invalid product ID'),
    adjustment: z.number().refine((val) => val !== 0, {
      message: 'Adjustment cannot be zero',
    }),
    reason: z.string().min(5, 'Reason must be at least 5 characters'),
  })
  .strict();

const GetBatchesQuerySchema = z.object({
  productId: z.string().uuid().optional(),
});

const ExpiryQuerySchema = z.object({
  daysThreshold: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 30)),
});

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * GET /api/inventory/stock-levels
 * Get stock levels for all products (for POS product search)
 */
router.get('/stock-levels', async (req: Request, res: Response): Promise<void> => {
  try {
    const stockLevels = await inventoryService.getStockLevels(pool);
    res.json({
      success: true,
      data: stockLevels,
    });
  } catch (error: any) {
    console.error('Error getting stock levels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stock levels',
    });
  }
});

/**
 * GET /api/inventory/stock-levels/:productId
 * Get stock level for specific product
 */
router.get('/stock-levels/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const stockLevel = await inventoryService.getStockLevelByProduct(pool, productId);

    res.json({
      success: true,
      data: stockLevel,
    });
  } catch (error: any) {
    console.error('Error getting stock level:', error);

    if (error.message?.includes('not found')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get stock level',
    });
  }
});

/**
 * GET /api/inventory/batches
 * Get all batches for a product (FEFO order)
 */
router.get('/batches', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = GetBatchesQuerySchema.parse(req.query);
    
    if (query.productId) {
      const batches = await inventoryService.getBatchesByProduct(pool, query.productId);
      res.json({
        success: true,
        data: batches,
      });
    } else {
      // Get all batches
      const batches = await inventoryService.getAllBatches(pool, {});
      res.json({
        success: true,
        data: batches,
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }

    console.error('Error getting batches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batches',
    });
  }
});

/**
 * GET /api/inventory/batches/exists
 * Check if batch number exists
 */
router.get('/batches/exists', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchNumber } = req.query;

    if (!batchNumber || typeof batchNumber !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Batch number is required',
      });
      return;
    }

    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM inventory_batches WHERE batch_number = $1)',
      [batchNumber]
    );

    res.json({
      success: true,
      exists: result.rows[0].exists,
    });
  } catch (error: any) {
    console.error('Error checking batch exists:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check batch',
    });
  }
});

/**
 * GET /api/inventory/batches/expiring
 * Get batches expiring soon
 */
router.get('/batches/expiring', async (req: Request, res: Response): Promise<void> => {
  try {
    const { daysThreshold } = ExpiryQuerySchema.parse(req.query);
    const batches = await inventoryService.getBatchesExpiringSoon(pool, daysThreshold);

    res.json({
      success: true,
      data: batches,
      message: `Found ${batches.length} batches expiring within ${daysThreshold} days`,
    });
  } catch (error: any) {
    console.error('Error getting expiring batches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get expiring batches',
    });
  }
});

/**
 * GET /api/inventory/batches/product/:productId
 * Get available batches for product (FEFO order)
 */
router.get('/batches/product/:productId', inventoryController.getAvailableBatchesForProduct);

/**
 * GET /api/inventory/batches/:id
 * Get batch by ID
 */
router.get('/batches/:id', inventoryController.getBatchById);

/**
 * POST /api/inventory/batches/select
 * Select batches for quantity using FEFO logic
 */
router.post('/batches/select', inventoryController.selectBatchForQuantity);

/**
 * GET /api/inventory/reorder
 * Get products needing reorder
 */
router.get('/reorder', async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await inventoryService.getProductsNeedingReorder(pool);
    res.json({
      success: true,
      data: products,
      message: `${products.length} products need reordering`,
    });
  } catch (error: any) {
    console.error('Error getting products needing reorder:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get products needing reorder',
    });
  }
});

/**
 * GET /api/inventory/value
 * Get inventory value
 */
router.get('/value', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.query;
    const value = await inventoryService.getInventoryValue(pool, productId as string | undefined);
    res.json({
      success: true,
      data: value,
    });
  } catch (error: any) {
    console.error('Error getting inventory value:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get inventory value',
    });
  }
});

/**
 * Stock movement routes
 */
router.get('/movements', inventoryController.getStockMovements);

/**
 * GET /api/inventory/movements/product/:productId
 * Get movements by product
 */
router.get('/movements/product/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const movements = await inventoryService.getStockMovements(pool, { productId });
    res.json({
      success: true,
      data: movements,
    });
  } catch (error: any) {
    console.error('Error getting movements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get movements',
    });
  }
});

/**
 * Stock adjustment (manager only) - SamplePOS compatible
 */
router.post('/adjust', requireManager, async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = AdjustInventorySchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const result = await inventoryService.adjustInventory(
      pool,
      validatedData.productId,
      validatedData.adjustment,
      validatedData.reason,
      userId
    );

    res.json({
      success: true,
      data: result,
      message: 'Inventory adjusted successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }

    console.error('Error adjusting inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to adjust inventory',
    });
  }
});

/**
 * Reports and analytics (legacy routes)
 */
router.get('/low-stock', inventoryController.getLowStockProducts);
router.get('/valuation', inventoryController.getInventoryValuation);
router.get('/expiring', inventoryController.getExpiringBatches);

/**
 * GET /api/inventory/product-history/:productId
 * Get comprehensive transaction history for a product
 */
router.get('/product-history/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    // Get product info
    const productQuery = `
      SELECT id, name, sku, quantity_on_hand, cost_price, selling_price, reorder_level, unit_of_measure
      FROM products WHERE id = $1
    `;
    const productResult = await pool.query(productQuery, [productId]);
    
    if (productResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    
    const product = productResult.rows[0];

    // Get all sale items for this product (sales transactions)
    const salesQuery = `
      SELECT 
        si.id,
        si.sale_id,
        s.sale_number,
        si.quantity,
        si.unit_price,
        si.discount_amount,
        si.total_price as line_total,
        s.sale_date,
        s.payment_method,
        s.status as sale_status,
        u.full_name as cashier_name,
        c.name as customer_name
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE si.product_id = $1
      ORDER BY s.sale_date DESC
      LIMIT 100
    `;
    const salesResult = await pool.query(salesQuery, [productId]);

    // Get goods receipts for this product (purchases/stock in)
    const receiptsQuery = `
      SELECT 
        gri.id,
        gri.goods_receipt_id,
        gr.receipt_number,
        gri.received_quantity,
        gri.cost_price as unit_cost,
        (gri.received_quantity * gri.cost_price) as line_total,
        gr.received_date,
        gr.status,
        sup.name as supplier_name,
        u.full_name as received_by
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
      LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
      LEFT JOIN suppliers sup ON po.supplier_id = sup.id
      LEFT JOIN users u ON gr.received_by_id = u.id
      WHERE gri.product_id = $1
      ORDER BY gr.received_date DESC
      LIMIT 100
    `;
    const receiptsResult = await pool.query(receiptsQuery, [productId]);

    // Get stock movements (if any)
    const movementsQuery = `
      SELECT 
        sm.id,
        sm.movement_number,
        sm.movement_type,
        sm.quantity,
        sm.reference_type,
        sm.reference_id,
        sm.notes,
        sm.created_at,
        u.full_name as created_by
      FROM stock_movements sm
      LEFT JOIN users u ON sm.created_by_id = u.id
      WHERE sm.product_id = $1
      ORDER BY sm.created_at DESC
      LIMIT 100
    `;
    const movementsResult = await pool.query(movementsQuery, [productId]);

    // Get inventory batches for this product
    const batchesQuery = `
      SELECT 
        ib.id,
        ib.batch_number,
        ib.quantity,
        ib.remaining_quantity,
        ib.cost_price,
        ib.expiry_date,
        ib.received_date,
        ib.status
      FROM inventory_batches ib
      WHERE ib.product_id = $1
      ORDER BY ib.received_date DESC
      LIMIT 50
    `;
    const batchesResult = await pool.query(batchesQuery, [productId]);

    // Calculate summary
    const totalSold = salesResult.rows
      .filter((s: any) => s.sale_status !== 'VOID')
      .reduce((sum: number, s: any) => sum + parseFloat(s.quantity), 0);
    
    const totalReceived = receiptsResult.rows
      .filter((r: any) => r.status !== 'CANCELLED')
      .reduce((sum: number, r: any) => sum + parseFloat(r.received_quantity), 0);
    
    const salesRevenue = salesResult.rows
      .filter((s: any) => s.sale_status !== 'VOID')
      .reduce((sum: number, s: any) => sum + parseFloat(s.line_total), 0);

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          quantityOnHand: parseFloat(product.quantity_on_hand),
          costPrice: parseFloat(product.cost_price),
          sellingPrice: parseFloat(product.selling_price),
          reorderLevel: parseFloat(product.reorder_level),
          unitOfMeasure: product.unit_of_measure,
        },
        summary: {
          totalSold,
          totalReceived,
          salesRevenue,
          salesCount: salesResult.rows.filter((s: any) => s.sale_status !== 'VOID').length,
          receiptsCount: receiptsResult.rows.filter((r: any) => r.status !== 'CANCELLED').length,
          movementsCount: movementsResult.rows.length,
          activeBatches: batchesResult.rows.filter((b: any) => b.status === 'ACTIVE').length,
        },
        sales: salesResult.rows.map((row: any) => ({
          id: row.id,
          saleId: row.sale_id,
          saleNumber: row.sale_number,
          quantity: parseFloat(row.quantity),
          unitPrice: parseFloat(row.unit_price),
          discountAmount: parseFloat(row.discount_amount || 0),
          lineTotal: parseFloat(row.line_total),
          saleDate: row.sale_date,
          paymentMethod: row.payment_method,
          status: row.sale_status,
          cashierName: row.cashier_name,
          customerName: row.customer_name,
        })),
        receipts: receiptsResult.rows.map((row: any) => ({
          id: row.id,
          receiptId: row.goods_receipt_id,
          receiptNumber: row.receipt_number,
          quantityReceived: parseFloat(row.received_quantity),
          unitCost: parseFloat(row.unit_cost),
          lineTotal: parseFloat(row.line_total),
          receivedDate: row.received_date,
          status: row.status,
          supplierName: row.supplier_name,
          receivedBy: row.received_by,
        })),
        movements: movementsResult.rows.map((row: any) => ({
          id: row.id,
          movementNumber: row.movement_number,
          movementType: row.movement_type,
          quantity: parseFloat(row.quantity),
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          notes: row.notes,
          createdAt: row.created_at,
          createdBy: row.created_by,
        })),
        batches: batchesResult.rows.map((row: any) => ({
          id: row.id,
          batchNumber: row.batch_number,
          quantity: parseFloat(row.quantity),
          remainingQuantity: parseFloat(row.remaining_quantity),
          costPrice: parseFloat(row.cost_price),
          expiryDate: row.expiry_date,
          receivedDate: row.received_date,
          status: row.status,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error getting product history:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get product history',
    });
  }
});

/**
 * GET /api/inventory/product-details/:productId
 * Get comprehensive product details including revenue, profit, stock value, supplier transactions
 */
router.get('/product-details/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    // Get full product info
    const productQuery = `
      SELECT p.*
      FROM products p
      WHERE p.id = $1
    `;
    const productResult = await pool.query(productQuery, [productId]);
    
    if (productResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    
    const product = productResult.rows[0];

    // Get sales analytics for this product
    const salesAnalyticsQuery = `
      SELECT 
        COUNT(DISTINCT si.sale_id) as total_sales_count,
        COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(si.total_price), 0) as total_revenue,
        COALESCE(SUM(si.profit), 0) as total_profit,
        COALESCE(AVG(si.unit_price), 0) as average_selling_price,
        COALESCE(MIN(si.unit_price), 0) as min_selling_price,
        COALESCE(MAX(si.unit_price), 0) as max_selling_price
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.product_id = $1 AND s.status != 'VOID'
    `;
    const salesAnalyticsResult = await pool.query(salesAnalyticsQuery, [productId]);
    const salesAnalytics = salesAnalyticsResult.rows[0];

    // Get purchase analytics for this product
    const purchaseAnalyticsQuery = `
      SELECT 
        COUNT(DISTINCT gri.goods_receipt_id) as total_receipts_count,
        COALESCE(SUM(gri.received_quantity), 0) as total_quantity_received,
        COALESCE(SUM(gri.received_quantity * gri.cost_price), 0) as total_purchase_cost,
        COALESCE(AVG(gri.cost_price), 0) as average_cost_price,
        COALESCE(MIN(gri.cost_price), 0) as min_cost_price,
        COALESCE(MAX(gri.cost_price), 0) as max_cost_price
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
      WHERE gri.product_id = $1 AND gr.status != 'CANCELLED'
    `;
    const purchaseAnalyticsResult = await pool.query(purchaseAnalyticsQuery, [productId]);
    const purchaseAnalytics = purchaseAnalyticsResult.rows[0];

    // Get inventory batches summary
    const batchSummaryQuery = `
      SELECT 
        COUNT(*) as total_batches,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_batches,
        COUNT(*) FILTER (WHERE status = 'EXPIRED') as expired_batches,
        COALESCE(SUM(remaining_quantity) FILTER (WHERE status = 'ACTIVE'), 0) as total_batch_quantity,
        COALESCE(SUM(remaining_quantity * cost_price) FILTER (WHERE status = 'ACTIVE'), 0) as batch_stock_value
      FROM inventory_batches
      WHERE product_id = $1
    `;
    const batchSummaryResult = await pool.query(batchSummaryQuery, [productId]);
    const batchSummary = batchSummaryResult.rows[0];

    // Get supplier transactions (purchases by supplier)
    const supplierTransactionsQuery = `
      SELECT 
        sup.id as supplier_id,
        sup.name as supplier_name,
        sup.contact_person,
        sup.phone,
        sup.email,
        COUNT(DISTINCT gri.goods_receipt_id) as receipts_count,
        COALESCE(SUM(gri.received_quantity), 0) as total_quantity,
        COALESCE(SUM(gri.received_quantity * gri.cost_price), 0) as total_value,
        COALESCE(AVG(gri.cost_price), 0) as average_cost,
        MAX(gr.received_date) as last_receipt_date
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gri.goods_receipt_id = gr.id
      JOIN purchase_orders po ON gr.purchase_order_id = po.id
      JOIN suppliers sup ON po.supplier_id = sup.id
      WHERE gri.product_id = $1 AND gr.status != 'CANCELLED'
      GROUP BY sup.id, sup.name, sup.contact_person, sup.phone, sup.email
      ORDER BY total_value DESC
    `;
    const supplierTransactionsResult = await pool.query(supplierTransactionsQuery, [productId]);

    // Calculate stock value and valuation
    const quantityOnHand = parseFloat(product.quantity_on_hand) || 0;
    const costPrice = parseFloat(product.cost_price) || 0;
    const sellingPrice = parseFloat(product.selling_price) || 0;
    
    const stockValueAtCost = quantityOnHand * costPrice;
    const stockValueAtSelling = quantityOnHand * sellingPrice;
    const potentialProfit = stockValueAtSelling - stockValueAtCost;
    const profitMargin = stockValueAtCost > 0 ? ((potentialProfit / stockValueAtCost) * 100) : 0;

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          description: product.description,
          category: product.category,
          categoryName: product.category,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          quantityOnHand: quantityOnHand,
          reorderLevel: parseFloat(product.reorder_level) || 0,
          unitOfMeasure: product.unit_of_measure,
          trackExpiry: product.track_expiry,
          status: product.status,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
        },
        salesAnalytics: {
          totalSalesCount: parseInt(salesAnalytics.total_sales_count),
          totalQuantitySold: parseFloat(salesAnalytics.total_quantity_sold),
          totalRevenue: parseFloat(salesAnalytics.total_revenue),
          totalProfit: parseFloat(salesAnalytics.total_profit),
          averageSellingPrice: parseFloat(salesAnalytics.average_selling_price),
          minSellingPrice: parseFloat(salesAnalytics.min_selling_price),
          maxSellingPrice: parseFloat(salesAnalytics.max_selling_price),
        },
        purchaseAnalytics: {
          totalReceiptsCount: parseInt(purchaseAnalytics.total_receipts_count),
          totalQuantityReceived: parseFloat(purchaseAnalytics.total_quantity_received),
          totalPurchaseCost: parseFloat(purchaseAnalytics.total_purchase_cost),
          averageCostPrice: parseFloat(purchaseAnalytics.average_cost_price),
          minCostPrice: parseFloat(purchaseAnalytics.min_cost_price),
          maxCostPrice: parseFloat(purchaseAnalytics.max_cost_price),
        },
        batchSummary: {
          totalBatches: parseInt(batchSummary.total_batches),
          activeBatches: parseInt(batchSummary.active_batches),
          expiredBatches: parseInt(batchSummary.expired_batches),
          totalBatchQuantity: parseFloat(batchSummary.total_batch_quantity),
          batchStockValue: parseFloat(batchSummary.batch_stock_value),
        },
        stockValuation: {
          quantityOnHand: quantityOnHand,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          stockValueAtCost: stockValueAtCost,
          stockValueAtSelling: stockValueAtSelling,
          potentialProfit: potentialProfit,
          profitMargin: profitMargin,
        },
        supplierTransactions: supplierTransactionsResult.rows.map((row: any) => ({
          supplierId: row.supplier_id,
          supplierName: row.supplier_name,
          contactPerson: row.contact_person,
          phone: row.phone,
          email: row.email,
          receiptsCount: parseInt(row.receipts_count),
          totalQuantity: parseFloat(row.total_quantity),
          totalValue: parseFloat(row.total_value),
          averageCost: parseFloat(row.average_cost),
          lastReceiptDate: row.last_receipt_date,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error getting product details:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get product details',
    });
  }
});

export default router;
