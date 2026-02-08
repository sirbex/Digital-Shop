import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';
import * as productsRepository from './productsRepository.js';

export interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitOfMeasure: string;
  conversionFactor: number;
  costPrice: number;
  sellingPrice: number;
  costingMethod: 'FIFO' | 'AVCO' | 'STANDARD';
  averageCost: number;
  lastCost: number;
  pricingFormula: string | null;
  autoUpdatePrice: boolean;
  quantityOnHand: number;
  reorderLevel: number;
  trackExpiry: boolean;
  isTaxable: boolean;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductData {
  sku?: string; // Optional - will be auto-generated if not provided
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  conversionFactor?: number;
  costPrice: number;
  sellingPrice: number;
  costingMethod?: 'FIFO' | 'AVCO' | 'STANDARD';
  pricingFormula?: string;
  autoUpdatePrice?: boolean;
  reorderLevel?: number;
  trackExpiry?: boolean;
  isTaxable?: boolean;
  taxRate?: number;
}

export interface UpdateProductData {
  sku?: string;
  barcode?: string;
  name?: string;
  description?: string;
  category?: string;
  unitOfMeasure?: string;
  conversionFactor?: number;
  costPrice?: number;
  sellingPrice?: number;
  costingMethod?: 'FIFO' | 'AVCO' | 'STANDARD';
  pricingFormula?: string;
  autoUpdatePrice?: boolean;
  reorderLevel?: number;
  trackExpiry?: boolean;
  isTaxable?: boolean;
  taxRate?: number;
  isActive?: boolean;
}

/**
 * Convert database row to Product object
 */
function toProduct(row: productsRepository.ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    category: row.category,
    unitOfMeasure: row.unit_of_measure,
    conversionFactor: parseFloat(row.conversion_factor),
    costPrice: parseFloat(row.cost_price),
    sellingPrice: parseFloat(row.selling_price),
    costingMethod: row.costing_method,
    averageCost: parseFloat(row.average_cost),
    lastCost: parseFloat(row.last_cost),
    pricingFormula: row.pricing_formula,
    autoUpdatePrice: row.auto_update_price,
    quantityOnHand: parseFloat(row.quantity_on_hand),
    reorderLevel: parseFloat(row.reorder_level),
    trackExpiry: row.track_expiry,
    isTaxable: row.is_taxable,
    taxRate: parseFloat(row.tax_rate),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all products
 */
export async function getAllProducts(pool: Pool, filters?: {
  category?: string;
  trackExpiry?: boolean;
  search?: string;
  isActive?: boolean;
}): Promise<Product[]> {
  const rows = await productsRepository.getAllProducts(pool, filters);
  return rows.map(toProduct);
}

/**
 * Get product by ID
 */
export async function getProductById(pool: Pool, id: string): Promise<Product> {
  const row = await productsRepository.getProductById(pool, id);

  if (!row) {
    throw new Error('Product not found');
  }

  return toProduct(row);
}

/**
 * Get product by SKU
 */
export async function getProductBySku(pool: Pool, sku: string): Promise<Product | null> {
  const row = await productsRepository.getProductBySku(pool, sku);
  return row ? toProduct(row) : null;
}

/**
 * Get product by barcode
 */
export async function getProductByBarcode(pool: Pool, barcode: string): Promise<Product | null> {
  const row = await productsRepository.getProductByBarcode(pool, barcode);
  return row ? toProduct(row) : null;
}

/**
 * Create product
 */
export async function createProduct(pool: Pool, data: CreateProductData): Promise<Product> {
  // Validate SKU uniqueness if provided (auto-generation will handle uniqueness)
  if (data.sku) {
    const existingSku = await productsRepository.getProductBySku(pool, data.sku);
    if (existingSku) {
      throw new Error(`A product with SKU "${data.sku}" already exists: "${existingSku.name}". Please use a different SKU.`);
    }
  }

  // Validate barcode uniqueness if provided
  if (data.barcode) {
    const existingBarcode = await productsRepository.getProductByBarcode(pool, data.barcode);
    if (existingBarcode) {
      throw new Error(`A product with barcode "${data.barcode}" already exists: "${existingBarcode.name}". Please use a different barcode.`);
    }
  }

  // Validate product name uniqueness
  if (data.name) {
    const existingName = await productsRepository.getProductByName(pool, data.name);
    if (existingName) {
      throw new Error(`A product with name "${data.name}" already exists (SKU: ${existingName.sku}). Please use a different name.`);
    }
  }

  // Validate prices
  if (data.costPrice < 0) {
    throw new Error('Cost price cannot be negative');
  }

  if (data.sellingPrice < 0) {
    throw new Error('Selling price cannot be negative');
  }

  const row = await productsRepository.createProduct(pool, data);
  return toProduct(row);
}

/**
 * Update product
 */
export async function updateProduct(
  pool: Pool,
  id: string,
  data: UpdateProductData
): Promise<Product> {
  // Validate SKU uniqueness if changing
  if (data.sku) {
    const existing = await productsRepository.getProductBySku(pool, data.sku);
    if (existing && existing.id !== id) {
      throw new Error(`A product with SKU "${data.sku}" already exists: "${existing.name}". Please use a different SKU.`);
    }
  }

  // Validate barcode uniqueness if changing
  if (data.barcode) {
    const existing = await productsRepository.getProductByBarcode(pool, data.barcode);
    if (existing && existing.id !== id) {
      throw new Error(`A product with barcode "${data.barcode}" already exists: "${existing.name}". Please use a different barcode.`);
    }
  }

  // Validate product name uniqueness if changing
  if (data.name) {
    const existingName = await productsRepository.getProductByName(pool, data.name, id);
    if (existingName) {
      throw new Error(`A product with name "${data.name}" already exists (SKU: ${existingName.sku}). Please use a different name.`);
    }
  }

  // Validate prices if provided
  if (data.costPrice !== undefined && data.costPrice < 0) {
    throw new Error('Cost price cannot be negative');
  }

  if (data.sellingPrice !== undefined && data.sellingPrice < 0) {
    throw new Error('Selling price cannot be negative');
  }

  const row = await productsRepository.updateProduct(pool, id, data);
  return toProduct(row);
}

/**
 * Delete product
 */
export async function deleteProduct(pool: Pool, id: string): Promise<void> {
  await productsRepository.deleteProduct(pool, id);
  logger.info('Product deleted', { productId: id });
}

/**
 * Get low stock products
 */
export async function getLowStockProducts(pool: Pool): Promise<Product[]> {
  const rows = await productsRepository.getLowStockProducts(pool);
  return rows.map(toProduct);
}
