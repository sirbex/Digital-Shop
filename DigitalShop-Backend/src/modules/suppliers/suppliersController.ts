import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as suppliersService from './suppliersService.js';
// Import shared Zod validation schemas
import * as SupplierSchemas from '../../../../DigitalShop-Shared/dist/zod/supplier.js';
const { CreateSupplierSchema, UpdateSupplierSchema } = SupplierSchemas;

/**
 * GET /api/suppliers
 * Get all suppliers
 */
export async function getAllSuppliers(_req: Request, res: Response): Promise<void> {
  try {
    const suppliers = await suppliersService.getAllSuppliers(pool);

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve suppliers',
    });
  }
}

/**
 * GET /api/suppliers/with-payables
 * Get suppliers with outstanding payables
 */
export async function getSuppliersWithPayables(_req: Request, res: Response): Promise<void> {
  try {
    const suppliers = await suppliersService.getSuppliersWithPayables(pool);

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve suppliers with payables',
    });
  }
}

/**
 * GET /api/suppliers/search
 * Search suppliers
 */
export async function searchSuppliers(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    const suppliers = await suppliersService.searchSuppliers(pool, q);

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search suppliers',
    });
  }
}

/**
 * GET /api/suppliers/:id
 * Get supplier by ID
 */
export async function getSupplierById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const supplier = await suppliersService.getSupplierById(pool, id);

    res.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supplier',
    });
  }
}

/**
 * GET /api/suppliers/:id/transactions
 * Get supplier transaction history
 */
export async function getSupplierTransactions(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify supplier exists
    const supplier = await suppliersService.getSupplierById(pool, id);
    const transactions = await suppliersService.getSupplierTransactions(pool, id);

    res.json({
      success: true,
      data: {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          balance: supplier.balance,
          paymentTerms: supplier.paymentTerms,
        },
        transactions,
      },
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supplier transactions',
    });
  }
}

/**
 * POST /api/suppliers
 * Create new supplier
 */
export async function createSupplier(req: Request, res: Response): Promise<void> {
  try {
    const validated = CreateSupplierSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const supplier = await suppliersService.createSupplier(pool, data);

    res.status(201).json({
      success: true,
      data: supplier,
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
      error: error instanceof Error ? error.message : 'Failed to create supplier',
    });
  }
}

/**
 * PUT /api/suppliers/:id
 * Update supplier
 */
export async function updateSupplier(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = UpdateSupplierSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const supplier = await suppliersService.updateSupplier(pool, id, data);

    res.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
      return;
    }

    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update supplier',
    });
  }
}

/**
 * DELETE /api/suppliers/:id
 * Delete supplier (soft delete)
 */
export async function deleteSupplier(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    await suppliersService.deleteSupplier(pool, id);

    res.json({
      success: true,
      message: 'Supplier deleted successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Supplier not found') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete supplier',
    });
  }
}







