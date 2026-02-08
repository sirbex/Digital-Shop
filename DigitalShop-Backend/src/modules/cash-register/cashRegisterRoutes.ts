import { Router } from 'express';
import { authenticate, requireManager } from '../../middleware/auth.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(authenticate);

/**
 * Cash register routes - Placeholder for future implementation
 * Features: Session management, opening/closing balances, cash movements
 */
router.get('/sessions', (req, res) => {
  res.json({ success: true, data: [], message: 'Cash register module - coming soon' });
});

router.get('/current', (req, res) => {
  res.json({ success: true, data: null, message: 'No active session' });
});

router.get('/current-session', (req, res) => {
  res.json({ success: true, data: null, message: 'No active session' });
});

export default router;
