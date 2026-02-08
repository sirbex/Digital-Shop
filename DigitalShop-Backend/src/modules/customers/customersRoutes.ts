import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import * as customersController from './customersController.js';
import * as invoicesController from '../invoices/invoicesController.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * Customer routes
 */
router.get('/', customersController.getAllCustomers);
router.get('/with-balance', customersController.getCustomersWithBalance);
router.get('/search', customersController.searchCustomers);
router.get('/:id', customersController.getCustomerById);
router.get('/:id/transactions', customersController.getCustomerTransactions);
router.get('/:id/ledger', customersController.getCustomerLedger); // QuickBooks-style statement
router.get('/:id/account-summary', customersController.getCustomerAccountSummary); // Account overview with aging
router.get('/:customerId/invoices', invoicesController.getCustomerInvoices);

router.post('/', requireManager, customersController.createCustomer);
router.post('/:id/check-credit', customersController.checkCreditAvailability);
router.put('/:id', requireManager, customersController.updateCustomer);
router.delete('/:id', requireManager, customersController.deleteCustomer);

export default router;
