import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as productsService from './productsService.js';
// Import shared Zod validation schemas
import * as ProductSchemas from '../../../../DigitalShop-Shared/dist/zod/product.js';
const { CreateProductSchema, UpdateProductSchema } = ProductSchemas;

/**
 * GET /api/products
 * Get all products with optional filters
 */
export async function getAllProducts(req: Request, res: Response): Promise<void> {
  try {
    const { category, trackExpiry, search, status } = req.query;

    const filters: any = {};
    if (category) filters.category = category as string;
    if (trackExpiry !== undefined) filters.trackExpiry = trackExpiry === 'true';
    if (search) filters.search = search as string;
    // Map status to isActive boolean
    if (status === 'ACTIVE') filters.isActive = true;
    else if (status === 'INACTIVE') filters.isActive = false;

    const products = await productsService.getAllProducts(pool, filters);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve products',
    });
  }
}

/**
 * GET /api/products/low-stock
 * Get low stock products
 */
export async function getLowStockProducts(_req: Request, res: Response): Promise<void> {
  try {
    const products = await productsService.getLowStockProducts(pool);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve low stock products',
    });
  }
}

/**
 * GET /api/products/:id
 * Get product by ID
 */
export async function getProductById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const product = await productsService.getProductById(pool, id);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Product not found') {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve product',
    });
  }
}

/**
 * GET /api/products/sku/:sku
 * Get product by SKU
 */
export async function getProductBySku(req: Request, res: Response): Promise<void> {
  try {
    const { sku } = req.params;

    const product = await productsService.getProductBySku(pool, sku);

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve product',
    });
  }
}

/**
 * GET /api/products/barcode/:barcode
 * Get product by barcode
 */
export async function getProductByBarcode(req: Request, res: Response): Promise<void> {
  try {
    const { barcode } = req.params;

    const product = await productsService.getProductByBarcode(pool, barcode);

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve product',
    });
  }
}

/**
 * POST /api/products
 * Create new product
 */
export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const validated = CreateProductSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const product = await productsService.createProduct(pool, data);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues[0].message,
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create product',
    });
  }
}

/**
 * PUT /api/products/:id
 * Update product
 */
export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = UpdateProductSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const product = await productsService.updateProduct(pool, id, data);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.issues[0].message,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Product not found') {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update product',
    });
  }
}

/**
 * DELETE /api/products/:id
 * Delete product (soft delete)
 */
export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    await productsService.deleteProduct(pool, id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Product not found') {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
    });
  }
}







