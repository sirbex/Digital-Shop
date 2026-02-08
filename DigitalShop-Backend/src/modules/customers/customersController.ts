import { Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';
import * as customersService from './customersService.js';
// Import shared Zod validation schemas
import * as CustomerSchemas from '../../../../DigitalShop-Shared/dist/zod/customer.js';
const { CreateCustomerSchema, UpdateCustomerSchema } = CustomerSchemas;

/**
 * GET /api/customers
 * Get all customers
 */
export async function getAllCustomers(_req: Request, res: Response): Promise<void> {
  try {
    const customers = await customersService.getAllCustomers(pool);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customers',
    });
  }
}

/**
 * GET /api/customers/with-balance
 * Get customers with outstanding balance
 */
export async function getCustomersWithBalance(_req: Request, res: Response): Promise<void> {
  try {
    const customers = await customersService.getCustomersWithBalance(pool);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customers with balance',
    });
  }
}

/**
 * GET /api/customers/search
 * Search customers
 */
export async function searchCustomers(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    const customers = await customersService.searchCustomers(pool, q);

    res.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Controller error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search customers',
    });
  }
}

/**
 * GET /api/customers/:id
 * Get customer by ID
 */
export async function getCustomerById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const customer = await customersService.getCustomerById(pool, id);

    res.json({
      success: true,
      data: customer,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer',
    });
  }
}

/**
 * GET /api/customers/:id/transactions
 * Get customer transaction history
 */
export async function getCustomerTransactions(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify customer exists
    const customer = await customersService.getCustomerById(pool, id);
    const transactions = await customersService.getCustomerTransactions(pool, id);

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          balance: customer.balance,
          creditLimit: customer.creditLimit,
        },
        transactions,
      },
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer transactions',
    });
  }
}

/**
 * POST /api/customers
 * Create new customer
 */
export async function createCustomer(req: Request, res: Response): Promise<void> {
  try {
    const validated = CreateCustomerSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const customer = await customersService.createCustomer(pool, data);

    res.status(201).json({
      success: true,
      data: customer,
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
      error: error instanceof Error ? error.message : 'Failed to create customer',
    });
  }
}

/**
 * PUT /api/customers/:id
 * Update customer
 */
export async function updateCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validated = UpdateCustomerSchema.parse(req.body);
    const data = validated as any; // Cast to service type after validation

    const customer = await customersService.updateCustomer(pool, id, data);

    res.json({
      success: true,
      data: customer,
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

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update customer',
    });
  }
}

/**
 * DELETE /api/customers/:id
 * Delete customer (soft delete)
 */
export async function deleteCustomer(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    await customersService.deleteCustomer(pool, id);

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete customer',
    });
  }
}

/**
 * POST /api/customers/:id/check-credit
 * Check if customer can make credit purchase
 */
export async function checkCreditAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({
        success: false,
        error: 'Valid amount is required',
      });
      return;
    }

    const result = await customersService.canMakeCreditPurchase(pool, id, amount);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to check credit availability',
    });
  }
}

/**
 * GET /api/customers/:id/ledger
 * Get customer ledger (full statement with running balance like QuickBooks)
 */
export async function getCustomerLedger(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Verify customer exists
    const customer = await customersService.getCustomerById(pool, id);
    const ledger = await customersService.getCustomerLedger(
      pool, 
      id,
      startDate as string | undefined,
      endDate as string | undefined
    );

    // Calculate totals
    const totalDebits = ledger.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = ledger.reduce((sum, entry) => sum + entry.credit, 0);
    const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : 0;

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
        },
        ledger,
        summary: {
          totalDebits,
          totalCredits,
          openingBalance: 0, // Could calculate from before startDate
          closingBalance,
        },
      },
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer ledger',
    });
  }
}

/**
 * GET /api/customers/:id/account-summary
 * Get customer account summary with aging (like QuickBooks)
 */
export async function getCustomerAccountSummary(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Verify customer exists and get basic info
    const customer = await customersService.getCustomerById(pool, id);
    const summary = await customersService.getCustomerAccountSummary(pool, id);

    res.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          balance: customer.balance,
          creditLimit: customer.creditLimit,
          availableCredit: Math.max(0, customer.creditLimit - Math.abs(customer.balance)),
        },
        ...summary,
      },
    });
  } catch (error) {
    console.error('Controller error:', error);

    if (error instanceof Error && error.message === 'Customer not found') {
      res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve customer account summary',
    });
  }
}







