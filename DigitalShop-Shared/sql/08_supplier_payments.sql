-- ============================================================================
-- SUPPLIER PAYMENTS
-- ============================================================================
-- Tracks payments made to suppliers against their outstanding balance
-- Balance = SUM(received PO amounts) - SUM(supplier payments)
-- ============================================================================

-- Supplier Payments Table
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),  -- optional PO link
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_method payment_method NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference_number VARCHAR(200),
    notes TEXT,
    processed_by_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_supplier_payment_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- ============================================================================
-- Update supplier balance trigger to subtract payments
-- ============================================================================
-- NOTE: fn_update_supplier_balance_internal() and fn_recalculate_supplier_balance_on_payment()
-- are defined in 02_triggers.sql (Single Source of Truth).
-- This file only attaches the trigger to the supplier_payments table created above.

DROP TRIGGER IF EXISTS trg_sync_supplier_balance_on_payment ON supplier_payments;
CREATE TRIGGER trg_sync_supplier_balance_on_payment
    AFTER INSERT OR UPDATE OR DELETE ON supplier_payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_recalculate_supplier_balance_on_payment();
