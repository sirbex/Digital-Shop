-- ============================================================================
-- CHECK PAYMENT TRACKING
-- ============================================================================
-- Adds CHECK as a payment method and tracks check lifecycle
-- Check status: RECEIVED → DEPOSITED → CLEARED  (happy path)
--               RECEIVED → DEPOSITED → BOUNCED   (problem path)
--               RECEIVED → VOIDED                 (cancelled)
-- ============================================================================

-- 1. Add CHECK to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'CHECK';

-- 2. Add check-specific columns to invoice_payments
ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS check_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS check_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_date DATE;

-- Add constraint for valid check statuses
ALTER TABLE invoice_payments
  DROP CONSTRAINT IF EXISTS chk_invoice_payment_check_status;
ALTER TABLE invoice_payments
  ADD CONSTRAINT chk_invoice_payment_check_status
  CHECK (check_status IS NULL OR check_status IN ('RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'VOIDED'));

-- 3. Add check-specific columns to supplier_payments
ALTER TABLE supplier_payments
  ADD COLUMN IF NOT EXISTS check_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS check_status VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_date DATE;

ALTER TABLE supplier_payments
  DROP CONSTRAINT IF EXISTS chk_supplier_payment_check_status;
ALTER TABLE supplier_payments
  ADD CONSTRAINT chk_supplier_payment_check_status
  CHECK (check_status IS NULL OR check_status IN ('RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'VOIDED'));

-- 4. Indexes for check queries
CREATE INDEX IF NOT EXISTS idx_invoice_payments_check_status ON invoice_payments(check_status) WHERE check_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_check_status ON supplier_payments(check_status) WHERE check_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_payments_check_number ON invoice_payments(check_number) WHERE check_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_payments_check_number ON supplier_payments(check_number) WHERE check_number IS NOT NULL;

COMMENT ON COLUMN invoice_payments.check_number IS 'Check number for CHECK payments';
COMMENT ON COLUMN invoice_payments.check_status IS 'Lifecycle status: RECEIVED, DEPOSITED, CLEARED, BOUNCED, VOIDED';
COMMENT ON COLUMN invoice_payments.bank_name IS 'Bank name on the check';
COMMENT ON COLUMN invoice_payments.check_date IS 'Date written on the check (may differ from payment_date)';
