import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';
import { expensesController } from './expensesController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get routes (available to all authenticated users)
router.get('/', expensesController.getAll);
router.get('/categories', expensesController.getCategories);
router.get('/summary', expensesController.getSummary);
router.get('/by-category', expensesController.getByCategory);
router.get('/:id', expensesController.getById);

// Write routes (Manager+ only)
router.post('/', requireManager, expensesController.create);
router.put('/:id', requireManager, expensesController.update);
router.delete('/:id', requireManager, expensesController.delete);

export default router;
